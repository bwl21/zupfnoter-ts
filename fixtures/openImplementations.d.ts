import type { FixtureStage } from '../packages/core/src/testing/fixtureLoader.js';
export interface OpenImplementation {
    id: string;
    stage: 'song' | 'sheet' | 'both';
    summary: string;
    scope?: string;
    refs?: string[];
    fixtures?: string[];
    extracts?: number[];
    prompt?: string;
    notes?: string;
}
export interface DetectedFailure {
    stage: Extract<FixtureStage, 'song' | 'sheet'>;
    fixtureId: string;
    extractNr?: number;
}
export declare function getOpenImplementations(stage: Extract<FixtureStage, 'song' | 'sheet'>): OpenImplementation[];
export declare function formatOpenImplementations(entries: OpenImplementation[]): string;
export declare function coversDetectedFailure(entry: OpenImplementation, failure: DetectedFailure): boolean;
//# sourceMappingURL=openImplementations.d.ts.map