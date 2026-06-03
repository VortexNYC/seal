import { type ReactElement } from "react";

interface PageLastUpdateProps {
  date: Date;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export function PageLastUpdate({ date }: PageLastUpdateProps): ReactElement {
  return (
    <p className="text-fd-muted-foreground text-sm">
      Last updated on <time dateTime={date.toISOString()}>{dateFormatter.format(date)}</time>
    </p>
  );
}
