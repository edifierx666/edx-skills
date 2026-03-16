import subprocess
out1 = subprocess.check_output("cat test.json | python3 render_table_old.py --format readable --max-width 100 --max-col-width 50", shell=True, text=True)
out2 = subprocess.check_output("cat test.json | python3 scripts/render_table.py --format readable --max-width 100 --max-col-width 50", shell=True, text=True)

if out1 == out2:
    print("THE OUTPUTS ARE EXACTLY IDENTICAL FOR WIDE ARGS.")
else:
    print("DIFFERENCE!")
