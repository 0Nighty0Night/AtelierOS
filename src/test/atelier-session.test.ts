import { describe, expect, it } from 'vitest';
import {
  endSession,
  endDayState,
  finishBoot,
  initialState,
  pauseSession,
  parseBackup,
  startSession,
  type Session,
} from '@/lib/atelier';

const offline: Session = { status: 'offline', date: null };

describe('Atelier session lifecycle', () => {
  it('starts a new station offline', () => {
    expect(initialState().session).toEqual(offline);
  });

  it('boots an offline station before allowing it online', () => {
    const booting = startSession(offline, '2026-11-25');
    expect(booting).toEqual({ status: 'booting', date: '2026-11-25' });
    expect(finishBoot(booting)).toEqual({ status: 'online', date: '2026-11-25' });
  });

  it('pauses only an online station and resumes it through booting', () => {
    const online: Session = { status: 'online', date: '2026-11-25' };
    const standby = pauseSession(online);
    expect(standby).toEqual({ status: 'standby', date: '2026-11-25' });
    expect(pauseSession(offline)).toBe(offline);
    expect(startSession(standby, '2026-11-26')).toEqual({ status: 'booting', date: '2026-11-25' });
  });

  it('ends the day from online or standby and returns to offline', () => {
    expect(endSession({ status: 'online', date: '2026-11-25' })).toEqual(offline);
    expect(endSession({ status: 'standby', date: '2026-11-25' })).toEqual(offline);
    expect(endSession({ status: 'booting', date: '2026-11-25' })).toEqual({ status: 'booting', date: '2026-11-25' });
  });

  it('restores an interrupted boot as offline instead of locking the station', () => {
    expect(parseBackup({ ...initialState(), session: { status: 'booting', date: '2026-11-25' } }).session).toEqual(offline);
  });

  it('adds an offline session when importing legacy data', () => {
    const legacy: Record<string, unknown> = { ...initialState() };
    delete legacy['session'];
    expect(parseBackup(legacy).session).toEqual(offline);
  });

  it('preserves online and standby states when saving and loading', () => {
    const online: Session = { status: 'online', date: '2026-11-25' };
    const standby: Session = { status: 'standby', date: '2026-11-25' };
    expect(parseBackup({ ...initialState(), session: online }).session).toEqual(online);
    expect(parseBackup({ ...initialState(), session: standby }).session).toEqual(standby);
  });

  it('clears the conversation on OFFLINE without deleting progress or gallery', () => {
    const state = { ...initialState(), session: { status: 'online', date: '2026-11-26' } as Session,
      messages: [{ role: 'user' as const, content: 'Moja praca', at: 1 }],
      gallery: [{ image: 'data:image/png;base64,AAAA', date: '2026-11-26', note: 'Szkic' }],
      doneDays: ['2026-11-26'] };
    const ended = endDayState(state);
    expect(ended.messages).toEqual([]);
    expect(ended.session).toEqual(offline);
    expect(ended.gallery).toEqual(state.gallery);
    expect(ended.skills).toEqual(state.skills);
    expect(ended.doneDays).toEqual(['2026-11-26']);
    expect(parseBackup(ended).messages).toEqual([]);
  });

  it('preserves conversations through STANDBY, reload and resume', () => {
    const state = { ...initialState(), session: { status: 'online', date: '2026-11-26' } as Session,
      messages: [{ role: 'assistant' as const, content: 'Ćwiczymy dalej', at: 1 }] };
    const paused = parseBackup({ ...state, session: pauseSession(state.session) });
    expect(paused.messages).toEqual(state.messages);
    const resumed = { ...paused, session: finishBoot(startSession(paused.session)) };
    expect(resumed.session.status).toBe('online');
    expect(resumed.messages).toEqual(state.messages);
    expect(endDayState(paused).messages).toEqual([]);
  });
});
