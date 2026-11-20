import type { SVGProps } from "react";

// A small hand-picked set, drawn on a 24px grid with round 2px strokes.
// Directional icons (back) are flipped for RTL by the caller via `rtl:-scale-x-100`.
const paths = {
  sun: "M12 4V2M12 22v-2M4 12H2m20 0h-2M5.6 5.6 4.2 4.2m15.6 15.6-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  route: "M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12-10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  lists: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  plus: "M12 5v14M5 12h14",
  copy: "M9 9h10v10H9zM5 15V5h10",
  chat: "M4 5h16v11H9l-5 4V5zM8 9h8M8 12h5",
  paste: "M9 4h6v3H9zM8 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2M9 13h6M9 17h4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.5 7.5 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z",
  back: "M15 18l-6-6 6-6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  logout: "M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 17l-5-5 5-5M5 12h11",
  check: "M5 12.5l4.5 4.5L19 7.5",
  plane: "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2Z", // after Lucide (ISC)
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  close: "M6 6l12 12M18 6L6 18",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-4",
  share: "M12 3v12M7 8l5-5 5 5M5 14v6h14v-6",
  link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1",
  edit: "M4 20h4L19 9l-4-4L4 16v4z",
  bag: "M5 8h14l-1 12H6L5 8zM9 8V6a3 3 0 0 1 6 0v2",
  chevron: "M15 18l-6-6 6-6",
  drag: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-5-6",
  bed: "M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z",
  train: "M7 3h10a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2ZM5 10h14M9 14h.01M15 14h.01M8 17l-2 4M16 17l2 4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  map: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z",
  navigate: "M3 11l18-8-8 18-2-8-8-2Z",
  car: "M5 16v3M19 16v3M3 16h18v-4l-2-5H5l-2 5v4ZM7 13h.01M17 13h.01",
  cloud: "M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 9.4 4.3 4.3 0 0 0 7 18Z",
  cloudSun: "M8 4V2.5M3.5 8H2M4.8 4.8 3.8 3.8M12.2 4.8l1-1M5.3 10.3A3.5 3.5 0 1 1 11.5 6.6M9 20h8a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 8.1 12 3.9 3.9 0 0 0 9 20Z",
  rain: "M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 6.4 4.3 4.3 0 0 0 7 15ZM8 18l-1 3M12 18l-1 3M16 18l-1 3",
  snow: "M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 5.4 4.3 4.3 0 0 0 7 14ZM8 18h.01M12 20h.01M16 18h.01M10 22h.01M14 22h.01",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 24, ...props }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
