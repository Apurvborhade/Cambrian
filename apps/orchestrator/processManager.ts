export interface ManagedProcess {
  id: string;
  command: string;
  status: "spawned" | "stopped";
}

export class ProcessManager {
  private readonly processes: ManagedProcess[] = [];

  public spawn(id: string, command: string): ManagedProcess {
    const process: ManagedProcess = {
      id,
      command,
      status: "spawned"
    };

    this.processes.push(process);
    return process;
  }

  public stopAll(): ManagedProcess[] {
    for (const process of this.processes) {
      process.status = "stopped";
    }

    return [...this.processes];
  }
}
