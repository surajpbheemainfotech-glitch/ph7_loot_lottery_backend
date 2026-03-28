API HIT
  |
  v
declareResult(title)
  |
  v
[1] pools table se pool nikaalo
  |
  v
[2] results table me INSERT
    └── resultId milta hai
  |
  v
[3] tickets se REAL users nikaalo
  |
  v
[4] dummy_users se remaining fill
    └── total = 100 users
  |
  v
[5] result_users table me INSERT (100 users)
  |
  v
[6] tickets se GAME DATA nikaalo
    (user_number, draw_number)
  |
  v
[7] pickWinners()
    └── scores ke basis pe candidates
  |
  v
[8] REAL % RULE helper
    └── 1st / 2nd / 3rd decide
  |
  v
[9] prize % calculate
    └── 25% / 20% / 15%
  |
  v
[10] result_winners table me INSERT
  |
  v
COMMIT
