import { CommandStack } from './commands.js';
export interface WorkbenchCommandRuntime {
    getAbcText(): string;
    setAbcText(value: string): void;
    readDocument(): string;
    writeDocument(value: string): void;
    getSound(): string;
    render(): void;
    play(range: string): void;
    stop(): void;
    openHarpDuplicate(): void;
    openPanelDuplicate(target: string): void;
    setSpeed(speed: number): void;
    setEditorTab(tab: 'abc' | 'lyrics' | 'config'): void;
    setConfigEditorSection(section: string): void;
    setCurrentExtract(extract: number): void;
    setSound(sound: string): void;
    setSaveFormat(saveFormat: string): void;
    setLogLevel(level: string): void;
    setAutoRefresh(value: 'on' | 'off' | 'remote'): void;
    setSetting(key: string, value: string): void;
    getSetting(key: string): string | undefined;
    listSettings(): Record<string, string>;
    downloadAbc(): void;
    listLocalStore(): string[];
    saveLocalStore(): void;
    openLocalStore(id: string): string | undefined;
}
export declare function registerLegacyCommands(stack: CommandStack, runtime: WorkbenchCommandRuntime): void;
export declare function createLegacyCommandStack(runtime: WorkbenchCommandRuntime, log: (message: string) => void): CommandStack;
//# sourceMappingURL=legacyCommands.d.ts.map