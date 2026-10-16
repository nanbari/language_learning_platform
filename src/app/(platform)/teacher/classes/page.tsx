"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Pencil, Plus, Radio, Search, Trash2, Users, X } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { MAX_CLASS_NAME, type ClassRow, type StudentRef } from "@/lib/classes";
import { createClass, deleteClass, fetchTeacherClasses, updateClass } from "@/lib/classesApi";

/**
 * Mes classes : l'enseignant regroupe ses élèves. Le cours en direct se lance
 * pour une classe, et seuls ses élèves le voient dans leur espace.
 */
export default function TeacherClassesPage() {
  const { user } = useAuthStore();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [students, setStudents] = useState<StudentRef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchTeacherClasses()
      .then((data) => { setClasses(data.classes); setStudents(data.students); })
      .catch((e: Error) => { setError(e.message); setClasses((c) => c ?? []); });
  }, []);

  useEffect(load, [load]);

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createClass(newName);
      setNewName("");
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fffef9]">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <Link href="/teacher" className="flex items-center gap-2 text-gray-500 hover:text-[#BB908E] transition-colors">
          <ArrowLeft size={18} /> Tableau de bord
        </Link>
        <span className="font-black text-[#2d2d2d]" style={{ fontFamily: "'Fredoka One', cursive" }}>
          👥 Mes classes
        </span>
        <div className="w-32" />
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-[#2d2d2d] mb-1" style={{ fontFamily: "'Fredoka One', cursive" }}>
          Mes classes
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          Regroupez vos élèves en classes. Quand vous lancez un cours en direct pour une classe,
          ses élèves voient le bouton « Rejoindre » dans leur espace : aucun code à leur communiquer,
          et personne d&apos;autre ne peut entrer.
        </p>

        <form
          className="flex gap-2 mb-6"
          onSubmit={(e) => { e.preventDefault(); void add(); }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={MAX_CLASS_NAME}
            placeholder="Nom de la nouvelle classe (ex. : Mercredi 14 h)"
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:border-[#BB908E] outline-none text-sm"
          />
          <button
            type="submit"
            disabled={busy || !newName.trim()}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-full font-bold text-sm text-white shadow hover:shadow-md transition-all disabled:opacity-40"
            style={{ background: "#BB908E" }}
          >
            <Plus size={16} /> Créer
          </button>
        </form>

        {error && <p className="text-sm font-bold text-red-500 mb-4">{error}</p>}

        {classes === null ? (
          <p className="text-sm text-gray-400">Chargement des classes…</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-gray-600 bg-[#F5EEE8] rounded-xl p-4">
            Aucune classe pour l&apos;instant. Créez-en une, puis ajoutez-y vos élèves.
          </p>
        ) : (
          <div className="space-y-4">
            {classes.map((c) => (
              <ClassCard
                key={c.id}
                cls={c}
                students={students}
                showTeacher={!!user?.isAdmin && c.teacherId !== user.id}
                onChanged={load}
                onError={setError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassCard({
  cls, students, showTeacher, onChanged, onError,
}: {
  cls: ClassRow;
  students: StudentRef[];
  showTeacher: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}) {
  const [editingMembers, setEditingMembers] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(cls.studentIds));
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(cls.name);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const members = cls.studentIds.map((id) => byId.get(id)).filter((s): s is StudentRef => !!s);
  const visible = students.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()));

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      onChanged();
      return true;
    } catch (e) {
      onError((e as Error).message);
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

  const remove = () => {
    if (confirm(`Supprimer la classe « ${cls.name} » ? Les comptes des élèves ne sont pas supprimés.`)) {
      void run(() => deleteClass(cls.id));
    }
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between gap-3 mb-3">
        {renaming ? (
          <form className="flex-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); void saveName(); }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={MAX_CLASS_NAME}
              autoFocus
              className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-[#BB908E] outline-none font-bold"
            />
            <button type="submit" disabled={busy || !name.trim()} aria-label="Enregistrer le nom" className="p-2 rounded-full text-[#6B705C] hover:bg-[#6B705C]/10 disabled:opacity-40">
              <Check size={18} />
            </button>
            <button type="button" onClick={() => { setName(cls.name); setRenaming(false); }} aria-label="Annuler" className="p-2 rounded-full text-gray-400 hover:bg-gray-100">
              <X size={18} />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="font-black text-lg text-[#2d2d2d] truncate">{cls.name}</h2>
            {cls.live && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#BB908E]/15 text-[#BB908E] text-xs font-bold">
                <Radio size={12} /> En direct
              </span>
            )}
            {showTeacher && <span className="text-xs text-gray-400 font-semibold">· {cls.teacherName}</span>}
          </div>
        )}
        {!renaming && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setRenaming(true)} aria-label="Renommer" title="Renommer" className="p-2 rounded-full text-gray-400 hover:text-[#6B705C] hover:bg-[#6B705C]/10">
              <Pencil size={16} />
            </button>
            <button onClick={remove} disabled={busy} aria-label="Supprimer" title="Supprimer" className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      {!editingMembers ? (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            {members.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun élève dans cette classe.</p>
            ) : (
              members.map((s) => (
                <span key={s.id} className="px-3 py-1 rounded-full bg-[#F5EEE8] text-sm font-semibold text-[#2d2d2d]">{s.name}</span>
              ))
            )}
          </div>
          <button
            onClick={() => { setSelected(new Set(cls.studentIds)); setEditingMembers(true); }}
            className="flex items-center gap-1.5 text-sm font-bold text-[#6B705C] hover:underline"
          >
            <Users size={15} /> Choisir les élèves
          </button>
        </>
      ) : (
        <div>
          <div className="relative mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un élève"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:border-[#BB908E] outline-none text-sm"
            />
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-gray-400 mb-3">Aucun compte élève sur la plateforme.</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto grid sm:grid-cols-2 gap-1 mb-3">
              {visible.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#F5EEE8] cursor-pointer text-sm font-semibold text-[#2d2d2d]">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      className="accent-[#BB908E] w-4 h-4"
                    />
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void saveMembers()}
              disabled={busy}
              className="px-5 py-2 rounded-full font-bold text-sm text-white shadow disabled:opacity-40"
              style={{ background: "#6B705C" }}
            >
              Enregistrer ({selected.size} élève{selected.size > 1 ? "s" : ""})
            </button>
            <button onClick={() => setEditingMembers(false)} className="px-4 py-2 rounded-full font-bold text-sm text-gray-500 hover:bg-gray-100">
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
