export type CommandMode = "sync" | "async";

export interface CommandDefinition {
  name: string;
  mode: CommandMode;
  usage: string;
  description: string;
  reactionHint?: string;
}

export interface ParsedCommand {
  name: string;
  note: string;
}

export const commandRegistry: CommandDefinition[] = [
  {
    name: "/help",
    mode: "sync",
    usage: "/help",
    description: "Mostra esta lista.",
  },
  {
    name: "/new-grocery",
    mode: "async",
    usage: "/new-grocery [observação] + foto do cupom",
    description: "Importa uma compra de mercado para revisão.",
    reactionHint: "Depois da importação: ✅ aprova a compra, ❌ descarta a compra.",
  },
  {
    name: "/approve-grocery",
    mode: "sync",
    usage: "/approve-grocery",
    description: "Aprova uma compra respondendo a mensagem de proposta.",
  },
  {
    name: "/reject-grocery",
    mode: "sync",
    usage: "/reject-grocery",
    description: "Descarta uma compra respondendo a mensagem de proposta.",
  },
];

const commandsByName = new Map(commandRegistry.map((command) => [command.name, command]));

export function getCommand(name: string): CommandDefinition | null {
  return commandsByName.get(name) ?? null;
}

export function parseCommand(body: string | null | undefined): ParsedCommand | null {
  const trimmed = body?.trim();
  if (!trimmed?.startsWith("/")) return null;

  const [name, ...rest] = trimmed.split(/\s+/);
  if (!commandsByName.has(name)) return null;

  return {
    name,
    note: rest.join(" ").trim(),
  };
}

export function getHelpMessage(): string {
  const lines = ["🏦 *Kakeibo*", "📖 *Comandos disponíveis*", ""];

  for (const command of commandRegistry) {
    lines.push(`*${command.usage}*`);
    lines.push(command.description);
    if (command.reactionHint) lines.push(command.reactionHint);
    lines.push("");
  }

  return lines.join("\n").trim();
}
