import { describe, expect, it } from 'vitest';
import { backdropAttributeFor, backdropIntensityFor } from './backdrop';

/**
 * CT-13. Small function, three consequential cases — and one of them (the `off` route) is
 * the difference between a lap-time chart being readable in F3 and not.
 */

describe('CT-13 — backdropIntensityFor', () => {
  it('gives the landing page the full field, and nothing else', () => {
    expect(backdropIntensityFor('/')).toBe('full');
    expect(backdropIntensityFor('/seasons')).toBe('muted');
  });

  it('mutes every data surface', () => {
    for (const path of [
      '/seasons',
      '/seasons/2024',
      '/drivers',
      '/drivers/max_verstappen',
      '/teams',
      '/teams/ferrari',
      '/circuits',
      '/circuits/spa',
      '/compare',
      '/records',
    ]) {
      expect(backdropIntensityFor(path), path).toBe('muted');
    }
  });

  it('turns the field off on the race deep dive', () => {
    // F3's lap-chart surface. An animated field behind a lap-time trace is a legibility
    // defect, and at `off` the animated layers are removed from the DOM rather than paused
    // — a paused compositor layer still holds memory (§10 #24).
    expect(backdropIntensityFor('/seasons/2024/races/3')).toBe('off');
    expect(backdropIntensityFor('/seasons/1996/races/16')).toBe('off');
    expect(backdropIntensityFor('/seasons/2024/races/3/')).toBe('off');
  });

  it('mutes an unrecognised path — never full', () => {
    // The safe default is the quiet one: a route nobody thought about here must not get the
    // loudest background in the product.
    for (const path of [
      '/nonsense',
      '/seasons/2024/races',
      '/seasons/2024/races/3/laps',
      '/a/b/c/d/e',
      '',
    ]) {
      expect(backdropIntensityFor(path), path).toBe('muted');
    }
  });
});

describe('backdropAttributeFor', () => {
  it('maps the three levels onto the three data-bg values', () => {
    expect(backdropAttributeFor('/')).toBe('hero');
    expect(backdropAttributeFor('/records')).toBe('calm');
    expect(backdropAttributeFor('/seasons/2024/races/3')).toBe('off');
  });
});
