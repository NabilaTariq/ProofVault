"use client";

import { useState } from "react";
import type { Project } from "@/lib/types";
import { EditProjectModal } from "./edit-project-modal";

export function EditProjectButton({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        id="edit-project-btn"
        onClick={() => setOpen(true)}
        className="btn-secondary text-[12px]"
        aria-label="Edit project details"
      >
        Edit project
      </button>
      {open && <EditProjectModal project={project} onClose={() => setOpen(false)} />}
    </>
  );
}
