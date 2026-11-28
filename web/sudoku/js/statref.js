// The frozen reference time per move for Sudoku. NOT FITTED YET: a copy of Suguru's (tools/stats/fit_reference.py)
// until Sudoku exports exist; Focus only (Skill and Performance need a fitted reference). See tools/stats/README.md.
const STAT_REF = {
 "expert": 0.5,
 "lv": {
  "1": 0.3156,
  "3": 3.072,
  "5": 4.1142,
  "6": 3.2902,
  "7": 3.8732,
  "8": 3.9871,
  "9": 4.0857,
  "10": 4.1727,
  "11": 4.2505,
  "12": 4.3209
 },
 "p2Basic": 0.0591,
 "p3Basic": -0.1994,
 "p2Hard": -0.1716,
 "p3Hard": -0.0085,
 "pMoreBasic": -0.152,
 "fill": 0.187,
 "fill2": -0.6285,
 "sizeBasic": 0.3971,
 "sizeHard": 0.5824,
 "len": 0.0115,
 "gradeBasic": 0.0241,
 "gradeHard": -0.0499,
 "spread": 0.7265,
 "fitted": {
  "unfitted": "no Sudoku exports yet: the Suguru reference is used until they exist, and Skill and Performance are not shown"
 },
 "perGrade": 1.863,
 "gradeGame": 0.0662,
 "hardMid": 0.2851,
 "spreadHard": 1.2878,
 "readStart": {
  "focus": 1.1857,
  "time": 1.2857,
  "sd": 0.4124
 }
};
