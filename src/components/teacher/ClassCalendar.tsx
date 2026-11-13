"use client";
import { useMemo } from "react";
import { Radio } from "lucide-react";
import { WEEKDAYS, formatClock, formatHours, formatSchedule, type ClassRow, type ClassSchedule } from "@/lib/classes";
import { calendarRange, placeDay, type PlacedClass } from "@/lib/classCalendar";
import { ICON_STROKE } from "@/components/platform/ui";

/** Hauteur d'une heure dans la grille, en rem. */
const HOUR_REM = 4;
const rem = (minutes: number) => `${(minutes / 60) * HOUR_REM}rem`;

type Scheduled = ClassRow & { schedule: ClassSchedule };

const LINK_FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ms-ink focus-visible:ring-offset-2";

/**
 * Semaine type de l'enseignant : chaque classe à son jour et à son heure de
 * cours. Grille à partir d'un écran moyen, liste par jour sur téléphone. Une
 * classe mène à sa fiche, plus bas dans la page (ancre = identifiant).
 */
export default function ClassCalendar({ classes, tileOf, teacherOf, today }: {
  classes: ClassRow[];
  /** Couleurs de la classe, les mêmes que sa tuile dans la liste. */
  tileOf: (cls: ClassRow) => string;
  /** Nom de l'enseignant à afficher (admin qui voit la classe d'un collègue), sinon null. */
  teacherOf: (cls: ClassRow) => string | null;
  /** Jour courant (1 = lundi … 7 = dimanche), null tant qu'il n'est pas connu. */
  today: number | null;
}) {
  const scheduled = useMemo(() => classes.filter((c): c is Scheduled => c.schedule !== null), [classes]);
  const unscheduled = classes.filter((c) => c.schedule === null);
  const range = useMemo(() => calendarRange(scheduled.map((c) => c.schedule)), [scheduled]);
  const days = useMemo(
    () => WEEKDAYS.map((_, i) => placeDay(scheduled.filter((c) => c.schedule.day === i + 1).map((c) => ({ item: c, schedule: c.schedule })))),
    [scheduled],
  );
  const hours = Array.from({ length: (range.to - range.from) / 60 + 1 }, (_, i) => range.from + i * 60);

  if (classes.length === 0) return null;

  return (
    <div className="ms-panel overflow-hidden">
      {scheduled.length === 0 ? (
        <p className="px-4 py-5 text-sm text-ms-muted sm:px-5">
          Aucune classe n&apos;a encore d&apos;horaire. Sur une classe, ouvrez « Options » puis « Horaire » pour indiquer
          le jour et l&apos;heure du cours : elle apparaîtra ici.
        </p>
      ) : (
        <>
          {/* Grille : écrans moyens et grands. */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-ms-line">
              <div aria-hidden="true" />
              {WEEKDAYS.map((day, i) => (
                <div key={day} className={`border-l border-ms-line px-2 py-2 text-center text-sm ${today === i + 1 ? "bg-ms-surface-muted font-semibold" : "font-medium text-ms-muted"}`}>
                  <span className="xl:hidden">{day.slice(0, 3)}.</span>
                  <span className="hidden xl:inline">{day}</span>
                  {today === i + 1 && <span className="sr-only"> (aujourd&apos;hui)</span>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] py-3">
              <div aria-hidden="true" className="relative" style={{ height: rem(range.to - range.from) }}>
                {hours.map((h) => (
                  <span key={h} className="absolute right-2 -translate-y-1/2 text-xs tabular-nums text-ms-muted" style={{ top: rem(h - range.from) }}>
                    {formatClock(h)}
                  </span>
                ))}
              </div>
              {days.map((events, i) => (
                <div key={WEEKDAYS[i]} className={`relative border-l border-ms-line ${today === i + 1 ? "bg-ms-surface-muted/40" : ""}`} style={{ height: rem(range.to - range.from) }}>
                  {hours.map((h) => (
                    <div key={h} aria-hidden="true" className="absolute inset-x-0 border-t border-ms-line" style={{ top: rem(h - range.from) }} />
                  ))}
                  {events.length > 0 && (
                    <ul aria-label={WEEKDAYS[i]}>
                      {events.map((e) => <GridEvent key={e.item.id} event={e} rangeFrom={range.from} tile={tileOf(e.item)} teacher={teacherOf(e.item)} />)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Liste par jour : téléphone. */}
          <ul className="divide-y divide-ms-line md:hidden">
            {days.map((events, i) => events.length > 0 && (
              <li key={WEEKDAYS[i]} className="space-y-2 px-4 py-3">
                <h3 className="text-sm font-semibold">
                  {WEEKDAYS[i]}
                  {today === i + 1 && <span className="font-normal text-ms-muted"> · aujourd&apos;hui</span>}
                </h3>
                <ul className="space-y-2">
                  {events.map(({ item }) => {
                    const teacher = teacherOf(item);
                    return (
                      <li key={item.id}>
                        <a href={`#${item.id}`} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 ${tileOf(item)} ${LINK_FOCUS}`}>
                          <span className="w-28 flex-shrink-0 text-sm tabular-nums">{formatHours(item.schedule)}</span>
                          <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">
                            {item.name}
                            {teacher && <span className="font-normal"> · {teacher}</span>}
                          </span>
                          {item.live && <Radio size={16} strokeWidth={ICON_STROKE} aria-label="En direct" className="flex-shrink-0" />}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}

      {scheduled.length > 0 && unscheduled.length > 0 && (
        <p className="border-t border-ms-line px-4 py-3 text-sm text-ms-muted sm:px-5">
          Sans horaire :{" "}
          {unscheduled.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <a href={`#${c.id}`} className={`rounded font-semibold text-ms-ink underline underline-offset-2 ${LINK_FOCUS}`}>{c.name}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** Un cours dans la grille : placé à son heure, haut comme sa durée. */
function GridEvent({ event, rangeFrom, tile, teacher }: { event: PlacedClass<Scheduled>; rangeFrom: number; tile: string; teacher: string | null }) {
  const { item, from, to, lane, lanes } = event;
  const short = to - from < 60;
  return (
    <li
      className="absolute p-0.5"
      style={{ top: rem(from - rangeFrom), height: rem(to - from), left: `${(lane / lanes) * 100}%`, width: `${100 / lanes}%` }}
    >
      <a
        href={`#${item.id}`}
        title={`${item.name} · ${formatSchedule(item.schedule)}`}
        aria-label={`${item.name}, ${formatSchedule(item.schedule)}${teacher ? `, ${teacher}` : ""}${item.live ? ", en direct" : ""}`}
        className={`flex h-full flex-col overflow-hidden rounded-lg border-l-4 border-current px-2 ${short ? "justify-center" : "py-1.5"} ${tile} ${item.live ? "ring-2 ring-current" : ""} transition-shadow duration-[140ms] hover:shadow-[var(--ms-shadow-control)] ${LINK_FOCUS}`}
      >
        <span className="flex items-start gap-1 text-sm leading-5 font-semibold">
          <span className={`min-w-0 flex-1 ${to - from >= 90 && lanes === 1 ? "line-clamp-2" : "truncate"}`}>{item.name}</span>
          {item.live && <Radio size={14} strokeWidth={ICON_STROKE} aria-hidden="true" className="mt-[3px] flex-shrink-0" />}
        </span>
        {!short && <span className="truncate text-xs leading-4 tabular-nums">{formatHours(item.schedule)}</span>}
        {!short && teacher && <span className="truncate text-xs leading-4">{teacher}</span>}
      </a>
    </li>
  );
}
