"""Fit the frozen reference time per move on exports (Suguru), and write it for the app.

    python3 -I fit_reference.py OUT.js EXPORT.json [EXPORT.json ...]

The model, on the log of a move's time (seconds):
    log t = a[level] + places step (2, or 3 or more; separately for the basics and the hard steps)
          + m * log(places / 3) beyond 3 places (the basics: with many moves available, each is found sooner)
          + c1*fill + c2*fill^2 (the basics only: slowest about half way) + s * log(cells/36) (basics, hard)
          + l * log(1 + length) (chains and what-ifs)
          + gb * (grade - 4) (the basics: in a harder puzzle the next easy move takes longer to find, so Focus and
            Performance must not fall with the grade; C5 in TODO.md)
The first move of a game (the opening look) is left out. Interruptions would pull the fit: after a first fit, moves
more than 8 times their prediction are left out and the fit is repeated (twice). Levels with fewer than MIN_N moves
get their a[level] from the nearest fitted level below them plus the slope of a straight line in log(rung) through the
hard levels that have enough.

The reference is the fitted (typical) time times EXPERT, so it sits at a fast pace with room above real players.
"""
import json
import subprocess, math, sys
import numpy as np
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from moves import load

MIN_N = 12
EXPERT = 0.5          # the reference: half the fitted typical time (documented in the README; set by step 2)
BASIC = {1, 2}        # Suguru's basics: singles and the neighbour rule
CHAINS = {6, 7, 8, 9, 10, 11, 12}

def design(r, levels):
    b = r['L'] in BASIC
    x = [1.0 if r['L'] == L else 0.0 for L in levels]
    p2 = 1.0 if r['places'] == 2 else 0.0
    p3 = 1.0 if r['places'] >= 3 else 0.0
    ls = math.log(r['cells'] / 36)
    pl = math.log(max(r['places'], 3) / 3)
    x += [p2 if b else 0, p3 if b else 0, 0 if b else p2, 0 if b else p3, pl if b else 0,
          r['fill'] if b else 0, r['fill'] ** 2 if b else 0,
          ls if b else 0, 0 if b else ls,
          math.log(1 + r['len']) if r['L'] in CHAINS else 0,
          (r['grade'] - 4) if b else 0, 0 if b else (r['grade'] - 4)]
    return x

def fit(rows):
    levels = sorted({r['L'] for r in rows if r['L'] < 13})
    rows = [r for r in rows if r['i'] > 0 and r['L'] < 13]
    X = np.array([design(r, levels) for r in rows]); y = np.log([r['dt'] for r in rows])
    keep = np.ones(len(y), bool)
    for _ in range(3):
        cols = X[keep].any(axis=0)
        beta = np.zeros(X.shape[1])
        beta[cols], *_ = np.linalg.lstsq(X[keep][:, cols], y[keep], rcond=None)
        res = y - X @ beta
        keep = res < np.log(8)
    n = {L: int(sum(1 for r, k in zip(rows, keep) if k and r['L'] == L)) for L in levels}
    return levels, beta, n, float(np.median(np.abs(res[keep] - np.median(res[keep]))) * 1.4826), int((~keep).sum()), len(y)

def per_grade(paths, size=36):
    """How much longer the hard steps take per grade (a convention for one grade of speed): solved games without hints
    that have hard steps, log(total time of the hard steps) on the grade, at the profile's board size (6×6). Whole games
    grow more slowly per grade (the basics barely do), so the hard steps are what one grade of speed means."""
    rows, games = load(paths)
    tot = {}
    for r in rows:
        if r['cells'] == size and r['L'] > 2 and r['i'] > 0:
            tot[r['g']] = tot.get(r['g'], 0) + r['dt']
    G = [g for g in games if g['id'] in tot and g['hints'] == 0 and g['grade'] and not g['revealed']]
    x = np.array([g['grade'] for g in G]); y = np.log([tot[g['id']] for g in G])
    b = np.polyfit(x, y, 1)[0]
    res = y - np.polyval(np.polyfit(x, y, 1), x)
    se = math.sqrt(res.var() / ((x - x.mean()) ** 2).sum())
    return round(math.exp(b), 3), [round(math.exp(b - 1.645 * se), 3), round(math.exp(b + 1.645 * se), 3)], len(G)

def main():
    out, paths = sys.argv[1], sys.argv[2:]
    rows, games = load(paths)
    levels, beta, n, mad, dropped, total = fit(rows)
    k = len(levels)
    a = {L: float(beta[i]) for i, L in enumerate(levels)}
    # each unit's rung from the technique table (tools/grade/techniques.json), so a new unit gets its reference too
    tt = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'grade', 'techniques.json')))
    rung = {u['code']: u['rung'] for u in tt['units'] if 'suguru' in u.get('games', ['suguru'])}
    good = [L for L in levels if L not in BASIC and n[L] >= MIN_N]
    sl, ic = np.polyfit([math.log(rung[L]) for L in good], [a[L] for L in good], 1)
    # a level with too few moves: the nearest fitted level below it on the rung ladder, plus the line's slope over the rung
    # between them (anchored on its neighbour, so the mixed triple sits above the triples it extends; levels below every
    # fitted one take the line itself)
    for L in sorted(rung, key=lambda c: rung[c]):
        if L not in BASIC and (L not in a or n.get(L, 0) < MIN_N):
            below = [g for g in good if rung[g] < rung[L]]
            if below:
                g = max(below, key=lambda c: rung[c])
                a[L] = float(a[g] + sl * math.log(rung[L] / rung[g]))
            else:
                a[L] = float(ic + sl * math.log(rung[L]))
    names = ['p2Basic', 'p3Basic', 'p2Hard', 'p3Hard', 'pMoreBasic', 'fill', 'fill2', 'sizeBasic', 'sizeHard', 'len', 'gradeBasic', 'gradeHard']
    ref = dict(expert=EXPERT, lv={str(L): round(a[L] + math.log(EXPERT), 4) for L in sorted(a)},
               **{nm: round(float(beta[k + i]), 4) for i, nm in enumerate(names)},
               spread=round(mad, 4), fitted=dict(moves=total, left_out=dropped, n={str(L): n[L] for L in n},
                                                  games=len(games), rungSlope=round(float(sl), 4)))
    # the game level: how a game's reading (log of its basics' total time ÷ their reference) grows with the puzzle's
    # grade, beyond the moves (long searches before an easy move in a harder puzzle). Focus's normal is for the grade.
    pred = {}
    allrows = [r for r in rows if r['i'] > 0 and r['L'] < 13]
    for r in allrows:
        if r['L'] in BASIC:
            x = np.array(design(r, levels))
            pred.setdefault(r['g'], [0.0, 0.0])
            pred[r['g']][0] += r['dt']; pred[r['g']][1] += math.exp(float(x @ beta))
    gg = {g['id']: g for g in games}
    G = [(gg[k]['grade'], gg[k]['cells'], math.log(v[0] / v[1])) for k, v in pred.items() if gg[k]['grade'] and v[1] > 0]
    cells = sorted({c for _, c, _ in G})
    Xg = np.array([[gr] + [1.0 if c == z else 0.0 for z in cells] for gr, c, _ in G]); yg = np.array([y for *_, y in G])
    bg, *_ = np.linalg.lstsq(Xg, yg, rcond=None)
    rg = yg - Xg @ bg
    seg = math.sqrt(rg.var() / ((Xg[:, 0] - Xg[:, 0].mean()) ** 2).sum())
    pg, band, ng = per_grade(paths)
    ref['perGrade'] = pg
    ref['gradeGame'] = round(float(bg[0]), 4)
    # speed 0: the fitted player's hard steps (all of them, interruptions included), read as Skill reads finds: the
    # middle-half mean of the log residuals (statmodel.js smMid)
    hard_res = sorted(float(np.log(r['dt']) - (np.array(design(r, levels)) @ beta)) for r in allrows if r['L'] not in BASIC)
    q = len(hard_res) // 4
    ref['hardMid'] = round(float(np.mean(hard_res[q:len(hard_res) - q])), 4)
    # the hard steps vary far more than the basics (a find takes 3 to 5 times longer or shorter by itself): their own
    # robust spread, for the uncertainty of Skill's speed
    ref['spreadHard'] = round(float(1.4826 * np.median(np.abs(np.array(hard_res) - np.median(hard_res)))), 4)
    ref['fitted']['gradeGame'] = dict(se=round(seg, 4), games=len(G))
    ref['fitted']['perGrade'] = dict(band90=band, games=ng, size='6x6')
    write = lambda: open(out, 'w').write(
        "// Generated by tools/stats/fit_reference.py from exports. Do not edit by hand.\n"
        "// The frozen reference time per move, on the log of seconds (see tools/stats/README.md).\n"
        "const STAT_REF = " + json.dumps(ref, indent=1) + ";\n")
    write()
    # the typical game reading, read by statmodel.js itself with this reference (Focus's start and the expected time's)
    here = os.path.dirname(os.path.abspath(__file__))
    rs = json.loads(subprocess.run(['node', os.path.join(here, 'readstart.js'), 'suguru', out] + paths,
                                   capture_output=True, text=True, check=True).stdout)
    ref['readStart'] = dict(focus=rs['focus'], time=rs['time'], sd=rs['sd'])
    ref['fitted']['readStart'] = dict(games=rs['games'])
    write()
    print(json.dumps(ref, indent=1))

if __name__ == '__main__':
    main()
