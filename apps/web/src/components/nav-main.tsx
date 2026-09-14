import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import { Lock, type Icon } from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: Icon;
    isActive?: boolean;
    items?: {
      title: string;
      url: string;
      isActive?: boolean;
      locked?: boolean;
    }[];
  }[];
}) {
  const navigate = useNavigate();

  return (
    <Sidebar.Group>
      <Sidebar.Menu>
        {items.map((item) => (
          <Sidebar.MenuItem key={item.title}>
            <Sidebar.Collapsible defaultOpen={item.isActive}>
              <Sidebar.CollapsibleTrigger
                render={
                  <Sidebar.MenuButton
                    tooltip={item.title}
                    active={item.isActive}
                    icon={item.icon}
                  >
                    {item.title}
                    <Sidebar.MenuChevron />
                  </Sidebar.MenuButton>
                }
              />
              <Sidebar.CollapsibleContent>
                <Sidebar.MenuSub>
                  {item.items?.map((subItem) => (
                    <Sidebar.MenuSubItem key={subItem.title}>
                      <Sidebar.MenuSubButton
                        active={subItem.isActive}
                        onClick={() => navigate({ to: subItem.url })}
                      >
                        <span className="flex-1 truncate">{subItem.title}</span>
                        {subItem.locked && (
                          <Lock className="text-kumo-secondary ml-auto h-3 w-3" />
                        )}
                      </Sidebar.MenuSubButton>
                    </Sidebar.MenuSubItem>
                  ))}
                </Sidebar.MenuSub>
              </Sidebar.CollapsibleContent>
            </Sidebar.Collapsible>
          </Sidebar.MenuItem>
        ))}
      </Sidebar.Menu>
    </Sidebar.Group>
  );
}
