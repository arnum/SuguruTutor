"""Read exports into one row per move, for the statistics model (Skill, Focus, Performance).

Several exports are merged; a game that appears more than once is taken from the export with the most detail
(full moves before the per-move summary `route.ctx`). Usage: from moves import load; rows, games = load(paths).

A row: game id, end time (unix s), cells, level (the technique the move needed, as `moveLevel` in route.js), time in s,
places (how many places the move could be made), fill (share of the board filled before the move), length (chains and
what-ifs; 0 when the export has none), index in the game (0 = first move, the opening look), and whether the row comes
from full moves.
"""
import json
from datetime import datetime


def _level(m):
    cls = m.get('cls')
    own = lambda: m.get('direct') if m.get('aheadSlow') else min(m.get('direct') or 13, m.get('ahead') or 13)
    if cls == 'easy':
        return own() if m.get('early') else m.get('avail')
    if cls == 'ahead':
        return m.get('ahead')
    if cls == 'harder':
        return own()
    if cls == 'guess':
        return 13
    return 0


def up_level(L):
    return L + 1 if isinstance(L, int) and not isinstance(L, bool) and L >= 4 else L


def levels_game(g):
    """An export from before the levels were renumbered (26 Nov 2026: the mixed pair came in as level 4, so the old
    levels 4-12 are now 5-13): moved along as the app does on import (main.js levelsGame, exports.js)."""
    for m in g.get('moves') or []:
        for k in ('direct', 'avail', 'ahead'):
            if k in m:
                m[k] = up_level(m[k])
    r = g.get('route') or {}
    for x in r.get('ctx') or []:
        x[0] = up_level(x[0])
    return g


def load(paths):
    """The exports merged as the app imports them: old level numbers moved along; per game the version that kept the
    most (moves, else the per-move summary), the newest export on a tie."""
    docs = sorted((json.load(open(p)) for p in paths), key=lambda d: d.get('exported') or '')
    best = {}
    for d in docs:
        old = (d.get('levelsV') or 1) < 2
        for g in d.get('history', []):
            if old:
                g = levels_game(g)
            rank = 2 if g.get('moves') else 1 if (g.get('route') or {}).get('ctx') else 0
            if rank and rank >= best.get(g['id'], (0, None))[0]:
                best[g['id']] = (rank, g)
    rows, games = [], []
    for rank, g in sorted(best.values(), key=lambda x: x[1]['end']):
        t = datetime.fromisoformat(g['end'].replace('Z', '+00:00')).timestamp()
        cells = g['rows'] * g['cols']
        given = cells - (g.get('empty') or 0)
        games.append(dict(id=g['id'], t=t, ms=g['ms'], cells=cells, grade=g.get('value') or 0, hints=g.get('hints', 0),
                          hintTechs=g.get('hintTechs') or [], full=rank == 2, revealed=bool(g.get('revealed'))))
        if rank == 2:
            j = 0
            for m in g['moves']:
                if m.get('cls') == 'wrong' or not m.get('dt'):
                    continue
                L = _level(m)
                if not L:
                    continue
                b = m.get('b') or ''
                fill = (sum(ch != "0" for ch in b) / cells) if b else min(1.0, (given + j) / cells)
                rows.append(dict(g=g['id'], t=t, cells=cells, L=L, dt=m['dt'] / 1000, places=m.get('nAvail') or 1,
                                 fill=fill, len=m.get('len') or 0, i=j, full=True, cls=m.get('cls'),
                                 grade=g.get('value') or 0))
                j += 1
        else:
            for j, e in enumerate(g['route']['ctx']):
                if e[1] <= 0:
                    continue
                rows.append(dict(g=g['id'], t=t, cells=cells, L=e[0], dt=e[1] / 10, places=e[2],
                                 fill=min(1.0, (given + j) / cells), len=e[3] if len(e) > 3 else 0, i=j, full=False, cls=None,
                                 grade=g.get('value') or 0))
    return rows, games
