import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoonIcon,
  SunriseIcon,
  MonitorDotIcon,
  FolderOpenIcon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { SelectDirectory, UpdateSetting, GetDefaultDownloadDir, GetSettings } from "../../wailsjs/go/main/App";
import { useEffect, useState } from "react";

export function SettingsView() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [defaultDir, setDefaultDir] = useState("");
  const [maxConcurrent, setMaxConcurrent] = useState(3);
  const [connectionsPerDL, setConnectionsPerDL] = useState(4);
  const [showNotifications, setShowNotifications] = useState(true);

  useEffect(() => {
    GetDefaultDownloadDir()
      .then((dir) => setDefaultDir(dir))
      .catch(console.error);

    GetSettings()
      .then((json) => {
        try {
          const parsed = JSON.parse(json);
          if (parsed.max_concurrent_dl) {
            setMaxConcurrent(parseInt(parsed.max_concurrent_dl, 10) || 3);
          }
          if (parsed.show_notifications !== undefined) {
            setShowNotifications(parsed.show_notifications === "true");
          }
          if (parsed.connections_per_download) {
            setConnectionsPerDL(parseInt(parsed.connections_per_download, 10) || 4);
          }
        } catch {}
      })
      .catch(console.error);
  }, []);

  const handleChangeDir = async () => {
    try {
      const dir = await SelectDirectory();
      if (dir) {
        setDefaultDir(dir);
        await UpdateSetting("default_download_dir", dir);
      }
    } catch (err) {
      console.error("Failed to change directory:", err);
    }
  };

  const handleMaxConcurrentChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 10) {
      setMaxConcurrent(num);
      UpdateSetting("max_concurrent_dl", String(num)).catch(console.error);
    }
  };

  const handleConnectionsChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 16) {
      setConnectionsPerDL(num);
      UpdateSetting("connections_per_download", String(num)).catch(console.error);
    }
  };

  const themeLabels = { system: "System", light: "Light", dark: "Dark" } as const;
  const ThemeIcon = resolvedTheme === "dark" ? MoonIcon : SunriseIcon;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-8 py-10 space-y-10">
        {/* Appearance */}
        <section className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
            <p className="text-sm text-muted-foreground mt-1">Customize the visual theme.</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm">Theme</Label>
              <p className="text-sm text-muted-foreground">
                Choose your preferred color scheme.
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="lg" className="gap-2 cursor-default">
                  <HugeiconsIcon icon={ThemeIcon} size={18} />
                  {themeLabels[theme]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("system")} className="gap-2 cursor-default">
                  <HugeiconsIcon icon={MonitorDotIcon} size={18} /> System
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("light")} className="gap-2 cursor-default">
                  <HugeiconsIcon icon={SunriseIcon} size={18} /> Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")} className="gap-2 cursor-default">
                  <HugeiconsIcon icon={MoonIcon} size={18} /> Dark
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </section>

        {/* Downloads */}
        <section className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Downloads</h3>
            <p className="text-sm text-muted-foreground mt-1">Default download settings.</p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <Label className="text-sm">Download folder</Label>
              <p className="text-sm text-muted-foreground truncate">{defaultDir}</p>
            </div>
            <Button variant="outline" size="lg" className="gap-2 shrink-0 cursor-default" onClick={handleChangeDir}>
              <HugeiconsIcon icon={FolderOpenIcon} size={18} /> Change
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Max concurrent downloads</Label>
              <p className="text-sm text-muted-foreground">
                Number of downloads that run simultaneously (1–10).
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxConcurrent}
              onChange={(e) => handleMaxConcurrentChange(e.target.value)}
              className="w-20 h-10 text-center text-sm"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm">Connections per download</Label>
              <p className="text-sm text-muted-foreground">
                Number of parallel segments for faster downloads (1–16).
              </p>
            </div>
            <Input
              type="number"
              min={1}
              max={16}
              value={connectionsPerDL}
              onChange={(e) => handleConnectionsChange(e.target.value)}
              className="w-20 h-10 text-center text-sm"
            />
          </div>
        </section>

        {/* Behavior */}
        <section className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Behavior</h3>
            <p className="text-sm text-muted-foreground mt-1">Control app behavior.</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="notif-switch" className="text-sm cursor-pointer">Show notifications</Label>
              <p className="text-sm text-muted-foreground">
                Notify when downloads complete.
              </p>
            </div>
            <Switch
              id="notif-switch"
              checked={showNotifications}
              onCheckedChange={(v) => {
                setShowNotifications(v);
                UpdateSetting("show_notifications", String(v)).catch(console.error);
              }}
            />
          </div>
        </section>

        {/* About */}
        <section className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold text-foreground">About</h3>
          </div>
          <div className="flex items-start gap-4 p-5 rounded-xl bg-muted">
            <HugeiconsIcon icon={InformationCircleIcon} size={22} className="text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Easy Download Manager</p>
              <p>Version 0.1.0 · Built with Wails, Go, and React</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
