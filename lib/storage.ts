import { promises as fs } from "fs";
import { resolve } from "path";
import { randomUUID } from "crypto";

type ProjectStatus = "pending" | "approved" | "rejected";

export type StoredProject = {
  id: string;
  title: string;
  summary: string;
  description: string;
  fundingGoal: number;
  fundingMint: string;
  metadataUri?: string;
  proposer: string;
  createdAt: string;
  status: ProjectStatus;
};

const pendingPath = resolve(process.cwd(), "storage/pending-projects.json");
const approvedPath = resolve(process.cwd(), "storage/approved-projects.json");

async function readJson<T>(path: string): Promise<T> {
  const data = await fs.readFile(path, "utf-8").catch(async (err) => {
    if (err.code === "ENOENT") {
      await fs.writeFile(path, "[]");
      return "[]";
    }
    throw err;
  });
  return JSON.parse(data) as T;
}

async function writeJson<T>(path: string, value: T): Promise<void> {
  await fs.writeFile(path, JSON.stringify(value, null, 2));
}

export async function listPendingProjects(): Promise<StoredProject[]> {
  return readJson<StoredProject[]>(pendingPath);
}

export async function listApprovedProjects(): Promise<StoredProject[]> {
  return readJson<StoredProject[]>(approvedPath);
}

export async function submitProject(payload: Omit<StoredProject, "id" | "createdAt" | "status">): Promise<StoredProject> {
  const pending = await listPendingProjects();
  const project: StoredProject = {
    id: randomUUID(),
    title: payload.title,
    summary: payload.summary,
    description: payload.description,
    fundingGoal: payload.fundingGoal,
    fundingMint: payload.fundingMint,
    metadataUri: payload.metadataUri,
    proposer: payload.proposer,
    createdAt: new Date().toISOString(),
    status: "pending"
  };
  pending.push(project);
  await writeJson(pendingPath, pending);
  return project;
}

export async function updateProjectStatus(
  id: string,
  status: Extract<ProjectStatus, "approved" | "rejected">
): Promise<{ approved: StoredProject[]; pending: StoredProject[] }> {
  const pending = await listPendingProjects();
  const approved = await listApprovedProjects();
  const index = pending.findIndex((item) => item.id === id);
  if (index === -1) {
    throw new Error("Project not found or already processed");
  }

  const [project] = pending.splice(index, 1);
  project.status = status;
  if (status === "approved") {
    approved.push(project);
    await writeJson(approvedPath, approved);
  }
  await writeJson(pendingPath, pending);
  return { approved, pending };
}
