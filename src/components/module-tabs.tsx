"use client";

import { Tabs } from "radix-ui";
import { useSearchParams } from "next/navigation";

export function ModuleTabs({
  tabs,
  label,
}: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  label: string;
}) {
  const params = useSearchParams();
  const selected = params.get("tab");
  const active = tabs.some((tab) => tab.id === selected)
    ? (selected ?? tabs[0].id)
    : tabs[0].id;
  return (
    <Tabs.Root
      value={active}
      onValueChange={(value) => {
        const query = new URLSearchParams();
        if (value !== tabs[0].id) query.set("tab", value);
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}${query.size ? `?${query}` : ""}`,
        );
      }}
    >
      <Tabs.List className="tabs" aria-label={label}>
        {tabs.map((tab) => (
          <Tabs.Trigger className="tab" key={tab.id} value={tab.id}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab.id} value={tab.id}>
          {tab.content}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
