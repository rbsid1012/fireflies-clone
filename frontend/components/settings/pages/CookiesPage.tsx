import { BarChart3, Lock, Megaphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Group, Row, SettingsPage } from "../primitives";

/** Nothing to configure: this app sets no tracking cookies. The page says exactly what is stored. */
export function CookiesPage() {
  return (
    <SettingsPage title="Cookies" description="What this app stores in your browser.">
      <Group title="Storage">
        <Row icon={Lock} title="Strictly necessary" description="Your login token, your theme, and whether you dismissed the cookie notice. Needed for the app to work.">
          <Switch checked disabled aria-label="Strictly necessary storage (always on)" />
        </Row>
        <Row icon={BarChart3} title="Analytics" description="This app doesn't load any analytics, so there is nothing to opt out of.">
          <Switch checked={false} disabled aria-label="Analytics (not used)" />
        </Row>
        <Row icon={Megaphone} title="Advertising" description="No advertising or tracking cookies are set.">
          <Switch checked={false} disabled aria-label="Advertising (not used)" />
        </Row>
      </Group>
      <p className="text-[13px] leading-6 text-muted-foreground">Everything is stored in your browser&apos;s local storage and cleared when you log out of this device or clear site data.</p>
    </SettingsPage>
  );
}
