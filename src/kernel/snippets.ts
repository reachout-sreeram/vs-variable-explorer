export function getBootstrapSnippet(viewTag: string, detailTag: string): string {
  return `
def __vexp_setup():
    import json as _json
    from spyder_kernels.utils.nsview import make_remote_view, value_to_display

    _EXCLUDED = ['In', 'Out', 'exit', 'get_ipython', 'quit']
    _SETTINGS = {
        'check_all': False,
        'exclude_private': True,
        'exclude_uppercase': False,
        'exclude_capitalized': False,
        'exclude_unsupported': False,
        'excluded_names': _EXCLUDED,
        'minmax': False,
        'show_callable_attributes': False,
        'show_special_attributes': False,
        'exclude_callables_and_modules': True,
        'filter_on': True,
    }

    def _view():
        ns = get_ipython().user_ns
        v = make_remote_view(ns, _SETTINGS, _EXCLUDED)
        print("${viewTag}" + _json.dumps(v, default=str) + "${viewTag}")

    def _detail(name, row_offset=0, row_limit=200, col_offset=0, col_limit=50):
        ns = get_ipython().user_ns
        if name not in ns:
            print("${detailTag}" + _json.dumps({"error": "not found"}) + "${detailTag}")
            return
        obj = ns[name]
        payload = {"name": name, "type": type(obj).__name__}
        try:
            import pandas as _pd
        except Exception:
            _pd = None
        try:
            import numpy as _np
        except Exception:
            _np = None
        if _pd is not None:
            if isinstance(obj, _pd.Series):
                obj = obj.to_frame()
            elif _np is not None and isinstance(obj, _np.ndarray) and obj.ndim <= 2:
                obj = _pd.DataFrame(obj)
        if _pd is not None and isinstance(obj, _pd.DataFrame):
            total_rows = obj.shape[0]
            total_cols = obj.shape[1]
            sub = obj.iloc[row_offset : row_offset + row_limit, col_offset : col_offset + col_limit]
            payload["kind"] = "dataframe"
            payload["columns"] = [str(c) for c in sub.columns]
            payload["index"] = [str(i) for i in sub.index]
            payload["data"] = sub.astype(object).where(sub.notna(), None).values.tolist()
            payload["shape"] = [total_rows, total_cols]
            payload["row_offset"] = row_offset
            payload["row_limit"] = row_limit
            payload["col_offset"] = col_offset
            payload["col_limit"] = col_limit
        elif isinstance(obj, (dict, list, tuple)):
            payload["kind"] = "json"
            payload["data"] = _json_safe(obj)
        else:
            payload["kind"] = "scalar"
            payload["data"] = value_to_display(obj)
        print("${detailTag}" + _json.dumps(payload, default=str) + "${detailTag}")

    def _json_safe(o, depth=0):
        if depth > 6:
            return str(o)
        if isinstance(o, dict):
            return {str(k): _json_safe(v, depth+1) for k, v in list(o.items())[:1000]}
        if isinstance(o, (list, tuple)):
            return [_json_safe(x, depth+1) for x in list(o)[:1000]]
        if isinstance(o, (str, int, float, bool)) or o is None:
            return o
        return str(o)

    def _runfile(filename, args=None, wdir=None):
        import os as _os
        import sys as _sys
        from IPython import get_ipython as _get_ipython
        
        filename = _os.path.abspath(filename)
        if wdir:
            wdir = _os.path.abspath(wdir)
        else:
            wdir = _os.path.dirname(filename)
            
        old_cwd = _os.getcwd()
        old_path = list(_sys.path)
        
        if wdir and _os.path.isdir(wdir):
            _os.chdir(wdir)
            if wdir not in _sys.path:
                _sys.path.insert(0, wdir)
                
        try:
            ipy = _get_ipython()
            if ipy:
                cmd = f'-i "{filename}"'
                if args:
                    cmd += f' {args}'
                ipy.run_line_magic('run', cmd)
        finally:
            _os.chdir(old_cwd)
            _sys.path = old_path

    import builtins as _b
    _b.__vexp_view = _view
    _b.__vexp_detail = _detail
    if not hasattr(_b, 'runfile'):
        _b.runfile = _runfile

__vexp_setup()
del __vexp_setup
`;
}

export function getViewSnippet(): string {
  return `__vexp_view()`;
}

export function getDetailSnippet(name: string, rowOffset: number = 0, rowLimit: number = 200, colOffset: number = 0, colLimit: number = 50): string {
  const escapedName = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `__vexp_detail("${escapedName}", row_offset=${rowOffset}, row_limit=${rowLimit}, col_offset=${colOffset}, col_limit=${colLimit})`;
}
