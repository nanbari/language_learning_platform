"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { BookOpen, CalendarClock, ChartNoAxesColumn, Ellipsis, Pencil, Plus, Presentation, Radio, Search, Trash2, Users } from "lucide-react";
import TeacherShell from "@/components/teacher/TeacherShell";
import { useTeacherSession } from "@/components/teacher/useTeacherSession";
import { DeckStatusPill } from "@/components/teacher/DeckStatusPill";
import ClassCalendar from "@/components/teacher/ClassCalendar";
import { Button, ButtonLink, EmptyState, ICON_STROKE, InlineNotice, SectionHeader, SkeletonRows, StatusPill } from "@/components/platform/ui";
import { DEFAULT_CLASS_MINUTES, MAX_CLASS_NAME, WEEKDAYS, formatSchedule, type ClassRow, type ClassSchedule, type StudentRef } from "@/lib/classes";
import { createClass, deleteClass, fetchTeacherClasses, updateClass } from "@/lib/api/classes";
import { fetchLessons, type ApiLesson } from "@/lib/api/lessons";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;

/** Tuiles des classes : les trois pastels de la charte, en alternance. */
const TILES = ["bg-ms-slate-soft text-ms-slate-ink", "bg-ms-sage-soft text-ms-sage-ink", "bg-ms-blush-soft text-ms-blush-ink"];

const MENU_ITEM = "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold outline-none data-[highlighted]:bg-ms-surface-muted";

/** Saisie d'un horaire : jour vide = classe sans horaire. */
interface ScheduleDraft { day: string; start: string; minutes: number }

const NO_SCHEDULE: ScheduleDraft = { day: "", start: "", minutes: DEFAULT_CLASS_MINUTES };
const DURATIONS = [30, 45, 50, 60, 75, 90, 105, 120, 150, 180];

const draftOf = (schedule: ClassSchedule | null): ScheduleDraft =>
  schedule ? { day: String(schedule.day), start: schedule.start, minutes: schedule.minutes } : NO_SCHEDULE;
/** Jour choisi mais heure manquante : la saisie n'est pas terminée. */
const draftIncomplete = (d: ScheduleDraft) => d.day !== "" && !/^\d{2}:\d{2}/.test(d.start);
const scheduleOf = (d: ScheduleDraft): ClassSchedule | null =>
  d.day === "" || draftIncomplete(d) ? null : { day: Number(d.day), start: d.start.slice(0, 5), minutes: d.minutes };
const durationLabel = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : minutes % 60 === 0 ? `${minutes / 60} h` : `${Math.floor(minutes / 60)} h ${minutes % 60}`;

/** Jour, heure de début et durée du cours hebdomadaire. */
function ScheduleFields({ ids, value, onChange }: { ids: string; value: ScheduleDraft; onChange: (value: ScheduleDraft) => void }) {
  const none = value.day === "";
  const durations = DURATIONS.includes(value.minutes) ? DURATIONS : [...DURATIONS, value.minutes].sort((a, b) => a - b);
  return (
    <div className="grid max-w-xl gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-day`} className="text-sm font-semibold">Jour du cours</label>
        <select id={`${ids}-day`} className="ms-field" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })}>
          <option value="">Sans horaire</option>
          {WEEKDAYS.map((day, i) => <option key={day} value={i + 1}>{day}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-start`} className="text-sm font-semibold">Heure de début</label>
        <input
          id={`${ids}-start`} type="time" step={300} className="ms-field" disabled={none} required={!none}
          value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-len`} className="text-sm font-semibold">Durée</label>
        <select id={`${ids}-len`} className="ms-field" disabled={none} value={value.minutes} onChange={(e) => onChange({ ...value, minutes: Number(e.target.value) })}>
          {durations.map((m) => <option key={m} value={m}>{durationLabel(m)}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Formulaire de création, replié derrière « Créer une classe ». */
function NewClassForm({ open, onOpenChange, onCreated }: {
  open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState<ScheduleDraft>(NO_SCHEDULE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || draftIncomplete(schedule)) return;
    setBusy(true);
    setError(null);
    try {
      await createClass(name, scheduleOf(schedule));
      setName("");
      setSchedule(NO_SCHEDULE);
      onOpenChange(false);
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button variant="primary" accent="blush" onClick={() => onOpenChange(true)}>
        <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Créer une classe
      </Button>
    );
  }

  return (
    <form onSubmit={submit} aria-labelledby={`${ids}-t`} className="ms-panel w-full space-y-4 p-4 sm:p-5">
      <h3 id={`${ids}-t`} className="font-semibold">Nouvelle classe</h3>
      <div className="flex max-w-xl flex-col gap-2">
        <label htmlFor={`${ids}-n`} className="text-sm font-semibold">Nom de la classe</label>
        <input
          id={`${ids}-n`} className="ms-field" value={name} onChange={(e) => setName(e.target.value)}
          maxLength={MAX_CLASS_NAME} autoFocus autoComplete="off" aria-describedby={`${ids}-h`}
        />
        <p id={`${ids}-h`} className="text-sm text-ms-muted">Par exemple : Les débutants. {MAX_CLASS_NAME} caractères au maximum.</p>
      </div>
      <ScheduleFields ids={ids} value={schedule} onChange={setSchedule} />
      <p className="text-sm text-ms-muted">L&apos;horaire place la classe dans le calendrier. Vous pourrez l&apos;indiquer ou le changer plus tard.</p>
      {error && <InlineNotice tone="error">{error}</InlineNotice>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" accent="blush" disabled={busy || !name.trim() || draftIncomplete(schedule)}>{busy ? "Création…" : "Créer la classe"}</Button>
        <Button variant="secondary" onClick={() => { onOpenChange(false); setError(null); }}>Annuler</Button>
      </div>
    </form>
  );
}

/**
 * Mes classes : l'espace de travail de l'enseignant. Chaque classe réunit ses
 * élèves et les leçons qui leur sont proposées ; de là, on prépare une leçon,
 * on ouvre le cours en direct et on consulte la progression. Les règles
 * (membres, nombre d'élèves, droits) restent vérifiées par l'API.
 */
export default function TeacherClassesPage() {
  const { user, isAdmin, handleLogout } = useTeacherSession();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<ApiLesson[] | null>(null);
  const [lessonsError, setLessonsError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // Jour courant (1 = lundi … 7 = dimanche), lu à l'arrivée des classes : mis en avant dans le calendrier.
  const [today, setToday] = useState<number | null>(null);

  const load = useCallback(() => {
    fetchTeacherClasses()
      .then((data) => { setClasses(data.classes); setStudents(data.students); setLoadError(null); setToday(((new Date().getDay() + 6) % 7) + 1); })
      .catch((e: Error) => { setLoadError(e.message); setClasses((c) => c ?? []); });
  }, []);

  // Toutes les leçons visibles par l'enseignant, regroupées ensuite par classe.
  const loadLessons = useCallback(() => {
    fetchLessons()
      .then((l) => { setLessons(l); setLessonsError(null); })
      .catch((e: Error) => { setLessonsError(e.message); setLessons((c) => c ?? []); });
  }, []);

  useEffect(load, [load]);
  useEffect(loadLessons, [loadLessons]);

  const lessonsByClass = useMemo(() => {
    const map = new Map<string, ApiLesson[]>();
    for (const lesson of lessons ?? []) {
      if (!lesson.classId) continue;
      const list = map.get(lesson.classId);
      if (list) list.push(lesson);
      else map.set(lesson.classId, [lesson]);
    }
    return map;
  }, [lessons]);

  /** Couleurs d'une classe : les mêmes dans le calendrier et dans la liste. */
  const tileOf = useCallback((cls: ClassRow) => TILES[Math.max(0, (classes ?? []).findIndex((c) => c.id === cls.id)) % TILES.length], [classes]);

  return (
    <TeacherShell name={user?.name || "Enseignant"} isAdmin={isAdmin} onLogout={handleLogout}>
      <div className="space-y-6">
        <header>
          <h1 className="text-[1.75rem] leading-9 lg:text-[2rem] lg:leading-10 font-semibold tracking-[-0.02em]">Mes classes</h1>
          <p className="mt-1 text-ms-muted max-w-[65ch]">
            Chaque classe réunit ses élèves et les leçons qui leur sont proposées. Une leçon enregistrée pour une classe
            est visible par ses élèves aussitôt ; le cours en direct, lui, projette le diaporama de la leçon.
          </p>
        </header>

        {classes && classes.length > 0 && (
          <section aria-labelledby="calendrier" className="space-y-3">
            <SectionHeader
              id="calendrier"
              title="Calendrier de la semaine"
              description="Chaque classe à son jour et à son heure de cours. Choisissez une classe pour l'ouvrir."
            />
            <ClassCalendar
              classes={classes}
              tileOf={tileOf}
              teacherOf={(c) => (isAdmin && c.teacherId !== user?.id ? c.teacherName : null)}
              today={today}
            />
          </section>
        )}

        <SectionHeader
          title="Classes"
          description={classes && classes.length > 0 ? plural(classes.length, "classe") : undefined}
          actions={!formOpen ? <NewClassForm open={false} onOpenChange={setFormOpen} onCreated={load} /> : undefined}
        />
        {formOpen && <NewClassForm open onOpenChange={setFormOpen} onCreated={load} />}

        {loadError && (
          <InlineNotice tone="error" action={<Button variant="secondary" onClick={load}>Réessayer</Button>}>
            Les classes n&apos;ont pas pu être chargées ({loadError}).
          </InlineNotice>
        )}
        {lessonsError && (
          <InlineNotice tone="error" action={<Button variant="secondary" onClick={loadLessons}>Réessayer</Button>}>
            Les leçons n&apos;ont pas pu être chargées ({lessonsError}).
          </InlineNotice>
        )}

        <div className="ms-panel overflow-hidden">
          {classes === null && <SkeletonRows rows={3} label="Chargement des classes" />}
          {classes && classes.length === 0 && !loadError && (
            <EmptyState
              title="Votre première classe"
              text="Créez une classe pour y regrouper vos élèves."
              action={!formOpen ? <Button variant="primary" accent="blush" onClick={() => setFormOpen(true)}>Créer une classe</Button> : undefined}
            />
          )}
          {classes && classes.length > 0 && (
            <ul className="divide-y divide-ms-line">
              {classes.map((c) => (
                <ClassItem
                  key={c.id}
                  cls={c}
                  tile={tileOf(c)}
                  students={students}
                  lessons={lessons === null ? null : (lessonsByClass.get(c.id) ?? [])}
                  canEditLesson={(l) => isAdmin || l.authorId === user?.id}
                  showTeacher={isAdmin && c.teacherId !== user?.id}
                  onChanged={load}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </TeacherShell>
  );
}

/** Une leçon de la classe : titre, activités, état du diaporama, et ses deux portes d'entrée. */
function ClassLessonRow({ lesson, canEdit }: { lesson: ApiLesson; canEdit: boolean }) {
  const activities = lesson.blocks.length;
  return (
    <li className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium [overflow-wrap:anywhere]">{lesson.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ms-muted">
          <span className="tabular-nums">{plural(activities, "activité")}</span>
          <span aria-hidden="true">·</span>
          <DeckStatusPill lesson={lesson} />
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && <ButtonLink href={`/teacher/create?edit=${lesson.id}`} variant="secondary">Modifier</ButtonLink>}
        <ButtonLink href={`/student/lesson/${lesson.id}`} variant="quiet">Voir comme un élève</ButtonLink>
      </div>
    </li>
  );
}

function ClassItem({
  cls, tile, students, lessons, canEditLesson, showTeacher, onChanged,
}: {
  cls: ClassRow;
  tile: string;
  students: StudentRef[];
  /** null tant que les leçons chargent. */
  lessons: ApiLesson[] | null;
  canEditLesson: (lesson: ApiLesson) => boolean;
  showTeacher: boolean;
  onChanged: () => void;
}) {
  const [editingMembers, setEditingMembers] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(cls.studentIds));
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleDraft>(draftOf(cls.schedule));
  const [name, setName] = useState(cls.name);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Une action choisie dans le menu ouvre un formulaire : on laisse le focus
  // aller à ce formulaire plutôt que revenir au bouton « Options ».
  const menuPicked = useRef(false);
  const ids = useId();

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const members = cls.studentIds.map((id) => byId.get(id)).filter((s): s is StudentRef => !!s);
  const visible = students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveMembers = async () => {
    if (await run(() => updateClass(cls.id, { studentIds: [...selected] }))) setEditingMembers(false);
  };

  const saveName = async () => {
    if (name.trim() === cls.name) { setRenaming(false); return; }
    if (await run(() => updateClass(cls.id, { name }))) setRenaming(false);
  };

  const saveSchedule = async () => {
    if (draftIncomplete(schedule)) return;
    if (await run(() => updateClass(cls.id, { schedule: scheduleOf(schedule) }))) setEditingSchedule(false);
  };

  const remove = async () => {
    if (!(await run(() => deleteClass(cls.id)))) setConfirmingDelete(false);
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startMembers = () => { setSelected(new Set(cls.studentIds)); setQuery(""); setEditingMembers(true); setError(null); };
  const startRename = () => { setName(cls.name); setRenaming(true); setError(null); };
  const startDelete = () => { setConfirmingDelete(true); setError(null); };
  const startSchedule = () => { setSchedule(draftOf(cls.schedule)); setEditingSchedule(true); setError(null); };

  const idle = !renaming && !editingMembers && !confirmingDelete && !editingSchedule;
  const lessonCount = lessons?.length ?? 0;

  return (
    <li id={cls.id} className="scroll-mt-24 space-y-4 px-4 py-5 sm:px-5">
      {/* En-tête : nom, état, effectif, et le menu Options (renommer, élèves, supprimer). */}
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span aria-hidden="true" className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${tile}`}>
            <Users size={20} strokeWidth={ICON_STROKE} />
          </span>
          <div className="min-w-0 flex-1">
            {renaming ? (
              <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
                <label htmlFor={`${ids}-name`} className="text-sm font-semibold">Nom de la classe</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id={`${ids}-name`} value={name} onChange={(e) => setName(e.target.value)}
                    maxLength={MAX_CLASS_NAME} autoFocus autoComplete="off"
                    className="ms-field min-w-0 flex-[1_1_14rem]"
                  />
                  <Button type="submit" variant="primary" disabled={busy || !name.trim()}>{busy ? "Enregistrement…" : "Enregistrer"}</Button>
                  <Button variant="secondary" onClick={() => { setName(cls.name); setRenaming(false); setError(null); }}>Annuler</Button>
                </div>
              </form>
            ) : (
              <>
                <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-lg leading-6 font-semibold [overflow-wrap:anywhere]">
                  {cls.name}
                  {cls.live && <StatusPill state="info" icon={Radio}>En direct</StatusPill>}
                </h3>
                <p className="mt-0.5 text-sm text-ms-muted tabular-nums">
                  {cls.schedule ? formatSchedule(cls.schedule) : "Sans horaire"} · {plural(members.length, "élève")}
                  {lessons !== null && <> · {plural(lessonCount, "leçon")}</>}
                  {showTeacher && <> · {cls.teacherName}</>}
                </p>
              </>
            )}
          </div>
        </div>

        {idle && (
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <Button variant="quiet" aria-label={`Options de « ${cls.name} »`} className="self-start">
                <Ellipsis size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Options
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                data-ms-app="" data-ms-area="teacher" align="end" sideOffset={6}
                onCloseAutoFocus={(e) => { if (menuPicked.current) { e.preventDefault(); menuPicked.current = false; } }}
                className="z-50 flex min-w-60 flex-col gap-0.5 rounded-xl border border-ms-line bg-ms-surface p-1.5 shadow-[var(--ms-shadow-dialog)]"
              >
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => { menuPicked.current = true; startMembers(); }}>
                  <Users size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Choisir les élèves
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => { menuPicked.current = true; startSchedule(); }}>
                  <CalendarClock size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Horaire
                </DropdownMenu.Item>
                <DropdownMenu.Item className={MENU_ITEM} onSelect={() => { menuPicked.current = true; startRename(); }}>
                  <Pencil size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Renommer
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-ms-line" />
                <DropdownMenu.Item
                  onSelect={() => { menuPicked.current = true; startDelete(); }}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-[0.9375rem] font-semibold text-ms-danger outline-none data-[highlighted]:bg-ms-danger-soft"
                >
                  <Trash2 size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Supprimer la classe
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {editingSchedule && (
        <form
          aria-label={`Horaire de « ${cls.name} »`} className="space-y-3 rounded-xl border border-ms-line p-4 sm:ml-[3.25rem]"
          onSubmit={(e) => { e.preventDefault(); void saveSchedule(); }}
        >
          <ScheduleFields ids={`${ids}-sch`} value={schedule} onChange={setSchedule} />
          <p className="text-sm text-ms-muted">Le cours revient chaque semaine, ce jour-là à cette heure. « Sans horaire » retire la classe du calendrier.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" disabled={busy || draftIncomplete(schedule)}>{busy ? "Enregistrement…" : "Enregistrer l'horaire"}</Button>
            <Button variant="secondary" onClick={() => { setEditingSchedule(false); setError(null); }}>Annuler</Button>
          </div>
        </form>
      )}

      {confirmingDelete && (
        <div role="group" aria-label={`Supprimer « ${cls.name} »`} className="flex flex-wrap items-center gap-2 rounded-xl bg-ms-danger-soft p-3 sm:pl-4">
          <p className="min-w-0 flex-[1_1_16rem] text-sm text-ms-danger">
            <span className="font-semibold">Supprimer la classe « {cls.name} » ?</span> Les comptes des élèves ne sont pas supprimés.
          </p>
          <Button variant="danger" disabled={busy} onClick={() => void remove()} autoFocus>{busy ? "Suppression…" : "Supprimer"}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => setConfirmingDelete(false)}>Annuler</Button>
        </div>
      )}

      {error && <InlineNotice tone="error">{error}</InlineNotice>}

      <div className="space-y-4 sm:pl-[3.25rem]">
        {/* Élèves */}
        {!editingMembers ? (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Élèves</h4>
            {members.length === 0 ? (
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ms-muted">
                Aucun élève dans cette classe.
                <Button variant="quiet" className="-my-2" onClick={startMembers}>Choisir les élèves</Button>
              </p>
            ) : (
              <ul aria-label={`Élèves de « ${cls.name} »`} className="flex flex-wrap gap-2">
                {members.map((s) => (
                  <li key={s.id} className="rounded-full bg-ms-surface-muted px-3 py-1 text-sm font-medium [overflow-wrap:anywhere]">{s.name}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <fieldset className="space-y-3 rounded-xl border border-ms-line p-4">
            <legend className="px-1 text-sm font-semibold">Élèves de la classe</legend>
            <div className="flex max-w-md flex-col gap-2">
              <label htmlFor={`${ids}-q`} className="text-sm font-semibold">Rechercher un élève</label>
              <div className="relative">
                <Search size={18} strokeWidth={ICON_STROKE} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ms-muted" />
                <input id={`${ids}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} className="ms-field pl-10" autoComplete="off" autoFocus />
              </div>
            </div>
            {students.length === 0 ? (
              <p className="text-sm text-ms-muted">Aucun compte élève sur la plateforme.</p>
            ) : visible.length === 0 ? (
              <p className="text-sm text-ms-muted">Aucun élève ne correspond à « {query.trim()} ».</p>
            ) : (
              <ul className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((s) => (
                  <li key={s.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm hover:bg-ms-surface-muted">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggle(s.id)}
                        className="h-5 w-5 flex-shrink-0 accent-[var(--ms-primary)]"
                      />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{s.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm tabular-nums text-ms-muted" aria-live="polite">{plural(selected.size, "élève sélectionné", "élèves sélectionnés")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => void saveMembers()} disabled={busy}>
                {busy ? "Enregistrement…" : `Enregistrer (${plural(selected.size, "élève")})`}
              </Button>
              <Button variant="secondary" onClick={() => { setEditingMembers(false); setError(null); }}>Annuler</Button>
            </div>
          </fieldset>
        )}

        {/* Leçons proposées à la classe */}
        <section aria-labelledby={`${ids}-lessons`} className="space-y-2">
          <h4 id={`${ids}-lessons`} className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen size={16} strokeWidth={ICON_STROKE} aria-hidden="true" /> Leçons
            {lessons !== null && lessonCount > 0 && <span className="font-normal text-ms-muted tabular-nums">({lessonCount})</span>}
          </h4>
          <div className="rounded-xl border border-ms-line">
            {lessons === null && (
              <div aria-busy="true" aria-label="Chargement des leçons" className="space-y-3 p-3">
                <div className="flex items-center gap-4"><div className="ms-skeleton h-4 w-40" /><div className="ms-skeleton h-4 w-24" /></div>
                <div className="flex items-center gap-4"><div className="ms-skeleton h-4 w-32" /><div className="ms-skeleton h-4 w-24" /></div>
              </div>
            )}
            {lessons && lessons.length === 0 && (
              <p className="px-3 py-3 text-sm text-ms-muted">Aucune leçon pour cette classe.</p>
            )}
            {lessons && lessons.length > 0 && (
              <ul className="divide-y divide-ms-line">
                {lessons.map((l) => <ClassLessonRow key={l.id} lesson={l} canEdit={canEditLesson(l)} />)}
              </ul>
            )}
          </div>
        </section>

        {/* Le travail d'enseignement : préparer, ouvrir le cours, suivre. */}
        <div className="flex flex-wrap gap-2" role="group" aria-label={`Actions pour « ${cls.name} »`}>
          <ButtonLink href={`/teacher/create?class=${cls.id}`} variant={cls.live ? "secondary" : "primary"}>
            <Plus size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Préparer une leçon
          </ButtonLink>
          <ButtonLink href={`/teacher/present?class=${cls.id}`} variant={cls.live ? "primary" : "secondary"}>
            {cls.live
              ? <><Radio size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Rejoindre le cours en cours</>
              : <><Presentation size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Ouvrir le cours en direct</>}
          </ButtonLink>
          <ButtonLink href={`/teacher?classe=${cls.id}#progression`} variant="quiet">
            <ChartNoAxesColumn size={18} strokeWidth={ICON_STROKE} aria-hidden="true" /> Voir la progression
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}
