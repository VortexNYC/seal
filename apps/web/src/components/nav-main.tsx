import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Lock, type Icon } from "@phosphor-icons/react";
import * as React from "react";

export type NavPrimaryItem = {
  title: string;
  url: string;
  icon: Icon;
  isActive: boolean;
};

export type NavGroupItem = {
  title: string;
  icon: Icon;
  isActive: boolean;
  items: {
    title: string;
    url: string;
    isActive: boolean;
    locked?: boolean;
    /** Open outside the SPA (e.g. docs.seal.nyc). */
    external?: boolean;
  }[];
};

function NavGroup({ group }: { group: NavGroupItem }) {
  // Uncontrolled: open only when this section owns the active route.
  // Remount when isActive flips so the section auto-opens on navigation.
  return (
    <Sidebar.MenuItem>
      <Sidebar.Collapsible
        key={`${group.title}:${group.isActive ? "on" : "off"}`}
        defaultOpen={group.isActive}
      >
        <Sidebar.CollapsibleTrigger
          render={
            <Sidebar.MenuButton
              tooltip={group.title}
              active={group.isActive}
              icon={group.icon}
            >
              {group.title}
              <Sidebar.MenuChevron />
            </Sidebar.MenuButton>
          }
        />
        <Sidebar.CollapsibleContent>
          <Sidebar.MenuSub>
            {group.items.map((subItem) => (
              <Sidebar.MenuSubButton
                key={subItem.title}
                active={subItem.isActive}
                href={subItem.url}
                {...(subItem.external
                  ? {
                      target: "_blank",
                      rel: "noopener noreferrer",
                    }
                  : {})}
              >
                <span className="flex-1 truncate">{subItem.title}</span>
                {subItem.locked ? (
                  <Lock className="text-kumo-secondary ml-auto h-3 w-3" />
                ) : null}
              </Sidebar.MenuSubButton>
            ))}
          </Sidebar.MenuSub>
        </Sidebar.CollapsibleContent>
      </Sidebar.Collapsible>
    </Sidebar.MenuItem>
  );
}

export function NavMain({
  primary = [],
  groups = [],
}: {
  primary?: NavPrimaryItem[];
  groups?: NavGroupItem[];
}) {
  return (
    <>
      <Sidebar.Group>
        <Sidebar.Menu>
          {primary.map((item) => (
            <Sidebar.MenuButton
              key={item.title}
              tooltip={item.title}
              active={item.isActive}
              icon={item.icon}
              href={item.url}
            >
              {item.title}
            </Sidebar.MenuButton>
          ))}
        </Sidebar.Menu>
      </Sidebar.Group>

      {groups.length > 0 ? (
        <Sidebar.Group>
          <Sidebar.GroupLabel>Manage</Sidebar.GroupLabel>
          <Sidebar.Menu>
            {groups.map((group) => (
              <NavGroup key={group.title} group={group} />
            ))}
          </Sidebar.Menu>
        </Sidebar.Group>
      ) : null}
    </>
  );
}
