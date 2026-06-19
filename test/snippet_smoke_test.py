import json, subprocess, sys

CODE = r'''
import json
from spyder_kernels.utils.nsview import make_remote_view
import pandas as pd
EXCLUDED = ["In","Out","exit","get_ipython","quit"]
S = {"check_all":False,"exclude_private":True,"exclude_uppercase":False,
     "exclude_capitalized":False,"exclude_unsupported":False,"excluded_names":EXCLUDED,
     "minmax":False,"show_callable_attributes":False,"show_special_attributes":False,
     "exclude_callables_and_modules":True,"filter_on":True}
ns = {"df": pd.DataFrame({"a":[1,2,3]}), "n": 42, "d": {"k":1}, "_p": 9}
v = make_remote_view(ns, S, EXCLUDED)
assert "df" in v and v["df"]["type"] == "DataFrame"
assert list(v["df"]["size"]) == [3, 1]
assert "n" in v and "d" in v
assert "_p" not in v   # private filtered
print("OK")
'''

out = subprocess.run([sys.executable, "-c", CODE], capture_output=True, text=True)
assert out.returncode == 0, out.stderr
assert "OK" in out.stdout
print("smoke test passed")
