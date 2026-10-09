from datetime import date

from tests.helpers import add_meeting, signup


def tasks(client, **params):
    return client.get("/api/tasks", params=params).json()


# ---------------------------------------------------------------- tasks

def test_tasks_span_every_meeting_and_add_up(seeded):
    open_, done, all_ = tasks(seeded, limit=100), tasks(seeded, status="done", limit=100), tasks(seeded, status="all", limit=100)
    library_total = sum(m["action_items_total"] for m in seeded.get("/api/meetings?limit=100").json()["items"])
    assert (open_["total"], done["total"], all_["total"]) == (19, 15, 34) and all_["total"] == library_total
    assert open_["counts"]["open"] == 19 and open_["counts"]["done"] == 15
    assert all(not t["is_completed"] for t in open_["items"]) and all(t["is_completed"] for t in done["items"])
    first = open_["items"][0]
    assert first["meeting_title"] and first["meeting_started_at"].endswith("Z") and first["meeting_id"]


def test_open_tasks_are_ordered_by_due_date_with_undated_last(seeded):
    dues = [t["due_date"] for t in tasks(seeded, limit=100)["items"]]
    dated = [d for d in dues if d]
    assert dated == sorted(dated)
    assert dues == dated + [None] * (len(dues) - len(dated))  # no undated item before a dated one


def test_mine_means_assigned_to_the_signed_in_person(seeded):
    mine = tasks(seeded, mine="true")
    assert mine["total"] == mine["counts"]["mine"] == 3
    assert all(t["assignee"]["name"] == "Alex Morgan" for t in mine["items"])
    assert tasks(seeded, mine="true", status="done")["total"] == 3  # done items assigned to Alex (the "mine" count only tracks open ones)


def test_overdue_counts_open_items_past_their_due_date(seeded):
    result = tasks(seeded, limit=100)
    expected = sum(1 for t in result["items"] if t["due_date"] and date.fromisoformat(t["due_date"]) < date.today())
    assert result["counts"]["overdue"] == expected


def test_task_filters_and_paging(seeded):
    standup = seeded.get("/api/meetings?q=standup").json()["items"][0]["id"]
    assert {t["meeting_id"] for t in tasks(seeded, meeting_id=standup, status="all")["items"]} == {standup}
    assert tasks(seeded, q="staging", status="all")["total"] == 2  # standup credentials + postmortem staging refresh
    assert tasks(seeded, q="zzzz")["total"] == 0
    assert tasks(seeded, q="100%_")["total"] == 0  # LIKE wildcards are escaped
    page1, page2 = tasks(seeded, limit=10), tasks(seeded, limit=10, page=2)
    assert len(page1["items"]) == 10 and len(page2["items"]) == 9
    assert not {t["id"] for t in page1["items"]} & {t["id"] for t in page2["items"]}
    assert seeded.get("/api/tasks?status=bogus").status_code == 422 and seeded.get("/api/tasks?limit=0").status_code == 422


def test_completing_a_task_moves_it_between_lists_and_counts(seeded):
    item = tasks(seeded)["items"][0]
    seeded.patch(f"/api/action-items/{item['id']}", json={"is_completed": True})
    after = tasks(seeded)
    assert after["total"] == 18 and after["counts"] == {**after["counts"], "open": 18, "done": 16}
    assert item["id"] in [t["id"] for t in tasks(seeded, status="done", limit=100)["items"]]
    assert tasks(seeded, status="done")["items"][0]["id"] == item["id"]  # most recently completed first


def test_tasks_are_private_to_each_account(anon_client):
    ada, bob = signup(anon_client), signup(anon_client, "bob@example.com", name="Bob")
    add_meeting(anon_client, ada, "Ada only")
    titles = lambda h: {t["meeting_title"] for t in anon_client.get("/api/tasks?status=all", headers=h).json()["items"]}
    assert "Ada only" in titles(ada) and "Ada only" not in titles(bob)
    assert anon_client.get("/api/tasks").status_code == 401


# ---------------------------------------------------------------- analytics

def test_analytics_summarises_the_library(seeded):
    data = seeded.get("/api/analytics?days=3650").json()
    meetings = seeded.get("/api/meetings?limit=100").json()["items"]
    totals = data["totals"]
    assert totals["meetings"] == 7 and totals["total_duration_ms"] == sum(m["duration_ms"] for m in meetings)
    assert totals["avg_duration_ms"] == totals["total_duration_ms"] // 7
    assert (totals["action_items_total"], totals["action_items_done"]) == (34, 15)
    assert abs(totals["completion_rate"] - 15 / 34) < 1e-9 and totals["people"] == 12


def test_talk_time_is_ranked_and_shares_are_sane(seeded):
    talk = seeded.get("/api/analytics?days=3650").json()["talk_time"]
    assert len(talk) == 10 and talk[0]["name"] == "Alex Morgan"  # Alex speaks in five meetings
    assert [t["ms"] for t in talk] == sorted((t["ms"] for t in talk), reverse=True)
    assert 0 < sum(t["share"] for t in talk) <= 1 and all(t["ms"] > 0 for t in talk)


def test_keywords_tags_and_weekly_buckets(seeded):
    data = seeded.get("/api/analytics?days=3650").json()
    assert data["keywords"] and data["keywords"][0]["count"] >= data["keywords"][-1]["count"]
    assert len(data["tags"]) == 8 and (data["tags"][0]["name"], data["tags"][0]["count"]) == ("engineering", 2)  # top 8; ties alphabetical
    assert [t["count"] for t in data["tags"]] == sorted((t["count"] for t in data["tags"]), reverse=True)
    weeks = [w["week_start"] for w in data["weekly"]]
    assert len(weeks) == 12 and weeks == sorted(weeks)
    assert all(date.fromisoformat(w).weekday() == 0 for w in weeks)  # weeks start on Monday
    assert date.fromisoformat(weeks[-1]) <= date.today()


def test_the_window_limits_what_is_counted(seeded):
    assert seeded.get("/api/analytics?days=7").json()["totals"]["meetings"] <= seeded.get("/api/analytics?days=3650").json()["totals"]["meetings"]
    assert seeded.get("/api/analytics?days=6").status_code == 422


def test_analytics_for_an_empty_account_is_all_zeros(anon_client):
    headers = signup(anon_client)
    for m in anon_client.get("/api/meetings", headers=headers).json()["items"]:
        anon_client.delete(f"/api/meetings/{m['id']}", headers=headers)
    data = anon_client.get("/api/analytics", headers=headers).json()
    assert data["totals"] == {"meetings": 0, "total_duration_ms": 0, "avg_duration_ms": 0, "action_items_total": 0,
                              "action_items_done": 0, "completion_rate": 0.0, "people": 0}
    assert data["talk_time"] == [] and data["keywords"] == [] and len(data["weekly"]) == 12


def test_analytics_only_counts_your_own_meetings(anon_client):
    ada, bob = signup(anon_client), signup(anon_client, "bob@example.com", name="Bob")
    add_meeting(anon_client, ada, "Extra")
    assert anon_client.get("/api/analytics", headers=ada).json()["totals"]["meetings"] == 2  # sample + Extra
    assert anon_client.get("/api/analytics", headers=bob).json()["totals"]["meetings"] == 1
