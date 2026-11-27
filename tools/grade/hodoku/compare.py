import json, subprocess, re, sys, collections, math
# usage: python3 compare.py path/to/hodoku.jar   (in a folder with puzzles.jsonl from gen.js)
JAR = sys.argv[1] if len(sys.argv) > 1 else 'hodoku.jar'
rows = [json.loads(l) for l in open('puzzles.jsonl')]
open('hd_in.txt', 'w').write(''.join(r['s'] + '\n' for r in rows))
subprocess.run(['java', '-Djava.awt.headless=true', '-jar', JAR, '/bs', 'hd_in.txt', '/o', 'hd_out.txt'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3000)
hd = {}
for line in open('hd_out.txt'):
    m = re.match(r'^([0-9.]{81}) #\d+ (\w+) \((\d+)\)', line.strip())
    if m: hd[m.group(1)] = (m.group(2), int(m.group(3)))
rows = [r for r in rows if r['s'] in hd]
for r in rows: r['hl'], r['hs'] = hd[r['s']]
def rank(xs):
    o = sorted(range(len(xs)), key=lambda i: xs[i]); rk = [0]*len(xs); i = 0
    while i < len(o):
        j = i
        while j + 1 < len(o) and xs[o[j+1]] == xs[o[i]]: j += 1
        for k in range(i, j+1): rk[o[k]] = (i + j) / 2
        i = j + 1
    return rk
def pearson(a, b):
    n = len(a); ma = sum(a)/n; mb = sum(b)/n
    sa = math.sqrt(sum((x-ma)**2 for x in a)); sb = math.sqrt(sum((y-mb)**2 for y in b))
    return sum((x-ma)*(y-mb) for x, y in zip(a, b)) / (sa*sb)
v = [r['value'] for r in rows]; s = [r['hs'] for r in rows]
print('puzzles', len(rows))
print('Spearman (our grade vs HoDoKu score):', round(pearson(rank(v), rank(s)), 3))
print('Pearson (our grade vs log HoDoKu score):', round(pearson(v, [math.log(x) for x in s]), 3))
LV = ['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme']
ct = collections.defaultdict(collections.Counter)
for r in rows: ct[r['gband']][r['hl']] += 1
print('\nour band x HoDoKu level')
print('band ' + ' '.join(f'{x:>8}' for x in LV))
for b in sorted(ct): print(f'{b:>4} ' + ' '.join(f'{ct[b][x]:>8}' for x in LV))
ct2 = collections.defaultdict(collections.Counter)
for r in rows: ct2[r['level']][r['hl']] += 1
print('\nour hardest technique level x HoDoKu level')
for b in sorted(ct2): print(f'{b:>4} ' + ' '.join(f'{ct2[b][x]:>8}' for x in LV))
# the largest disagreements in rank
rv, rs = rank(v), rank(s)
d = sorted(range(len(rows)), key=lambda i: rv[i] - rs[i])
print('\nwe rate much easier than HoDoKu:')
for i in d[:6]: r = rows[i]; print(f"  ours {r['value']:.1f} (L{r['level']}) HoDoKu {r['hl']} {r['hs']}  {r['s']}")
print('we rate much harder than HoDoKu:')
for i in d[-6:]: r = rows[i]; print(f"  ours {r['value']:.1f} (L{r['level']}) HoDoKu {r['hl']} {r['hs']}  {r['s']}")
json.dump(rows, open('joined.json', 'w'))
