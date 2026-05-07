from __future__ import annotations

import argparse
import shutil
from pathlib import Path


EXCLUDE_DIR_NAMES = {
    ".git",
    ".venv",
    ".venv_x_tis",
    "__pycache__",
}

EXCLUDE_FILE_SUFFIXES = {
    ".pyc",
    ".pyo",
}


ROOT_FILES = [
    # GNN training
    "train_eval_gnn.py",
    "train_eval_gnn_noleak.py",
    "live_detection.py",
    "run_gnn_pytorch.py",
    "x_tis.py",
    "x_tis_postprocess.py",
    "graphbuilder_clean.py",
    "graphbuilder.py",
    "build_graph.py",
    "make_preprocessed.py",
    "prep.py",
    "first1.py",
    # GNN inputs
    "service_stats.csv",
    "service_protocol_graph.gpickle",
    # KDD raw/preprocessed
    "KDDTrain+.txt",
    "KDDTest+.txt",
    "kdd_preprocessed.csv",
    # Optional existing eval artifacts (small)
    "eval_report.json",
    "eval_report_noleak.json",
    "paper_metrics_cv.csv",
    "paper_metrics_val.csv",
    "paper_noleak_metrics_cv.csv",
    "paper_noleak_metrics_val.csv",
]


def safe_copy_file(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copytree_filtered(
    src: Path,
    dst: Path,
    *,
    include_processed: bool,
    include_runs: bool,
    exclude_names: set[str] | None = None,
) -> None:
    if dst.exists():
        shutil.rmtree(dst)

    src_resolved = src.resolve()

    def _ignore(dir_path: str, names: list[str]) -> set[str]:
        ignored: set[str] = set()
        p = Path(dir_path)
        try:
            rel = p.resolve().relative_to(src_resolved)
        except Exception:
            rel = None

        # Drop very large artifacts unless explicitly requested.
        if rel is not None:
            rel_parts = set(rel.parts)
            if (not include_processed) and ("data" in rel_parts) and ("processed" in rel_parts):
                return set(names)
            if (not include_runs) and ("runs" in rel_parts):
                return set(names)

        for n in names:
            if n in EXCLUDE_DIR_NAMES:
                ignored.add(n)
                continue
            if exclude_names and n in exclude_names:
                ignored.add(n)
                continue
            if (p / n).is_file() and any(n.endswith(suf) for suf in EXCLUDE_FILE_SUFFIXES):
                ignored.add(n)
        return ignored

    shutil.copytree(src, dst, ignore=_ignore)


def main() -> None:
    ap = argparse.ArgumentParser(description="Create a portable GPU training bundle folder")
    ap.add_argument("--out", type=str, default="gpu_training_bundle", help="Output folder (created/overwritten)")
    ap.add_argument(
        "--project_dir",
        type=str,
        default=None,
        help="Where to copy the project content inside the bundle (default: <out>/project)",
    )
    ap.add_argument(
        "--include_optional_text_url",
        action="store_true",
        help="Also copy text/url/network heuristic detector folders (larger; not needed for model training)",
    )
    ap.add_argument(
        "--include_all",
        action="store_true",
        help=(
            "Copy the entire repository into the bundle project folder (recommended when you have space). "
            "This overrides selective copying and ignores only venv/cache folders and the bundle folder itself."
        ),
    )
    ap.add_argument(
        "--include_processed",
        action="store_true",
        help="Copy transformer_tabular/data/processed (large tensors; skipped by default)",
    )
    ap.add_argument(
        "--include_runs",
        action="store_true",
        help="Copy transformer_tabular/runs (models/metrics; skipped by default)",
    )
    args = ap.parse_args()

    repo_root = Path(__file__).resolve().parent
    out_root = (repo_root / args.out).resolve()
    project_out = Path(args.project_dir).resolve() if args.project_dir else out_root / "project"

    # Prevent recursive self-copy (e.g., copying gpu_training_bundle into itself)
    bundle_dir_name = out_root.name
    exclude_names = {bundle_dir_name}

    log_lines: list[str] = []
    log_lines.append(f"repo_root={repo_root}")
    log_lines.append(f"out_root={out_root}")
    log_lines.append(f"project_out={project_out}")
    log_lines.append(f"include_processed={bool(args.include_processed)}")
    log_lines.append(f"include_runs={bool(args.include_runs)}")

    out_root.mkdir(parents=True, exist_ok=True)

    # Copy dependency lockfile if present
    lock_src = repo_root / "requirements_lock_full.txt"
    lock_dst = out_root / "requirements_lock_full.txt"
    log_lines.append(f"requirements_lock_full.txt exists={lock_src.exists()}")
    if lock_src.exists():
        safe_copy_file(lock_src, lock_dst)

    # Create project folder
    project_out.mkdir(parents=True, exist_ok=True)
    log_lines.append("project_out created")

    if args.include_all:
        log_lines.append("include_all enabled")
        copytree_filtered(
            repo_root,
            project_out,
            include_processed=True,
            include_runs=True,
            exclude_names=exclude_names,
        )
        log_lines.append("copied full repository")

        (out_root / "bundle_log.txt").write_text("\n".join(log_lines) + "\n", encoding="utf-8")
        print(f"Bundle written to: {out_root}")
        print(f"Project copied to: {project_out}")
        return

    # Copy root-level training files
    copied_root = 0
    for rel in ROOT_FILES:
        src = repo_root / rel
        if src.exists() and src.is_file():
            safe_copy_file(src, project_out / rel)
            copied_root += 1
    log_lines.append(f"copied root files: {copied_root}")

    # Copy transformer tabular project (skip huge data by default)
    tt_src = repo_root / "transformer_tabular"
    log_lines.append(f"transformer_tabular exists={tt_src.exists()}")
    if tt_src.exists():
        copytree_filtered(
            tt_src,
            project_out / "transformer_tabular",
            include_processed=bool(args.include_processed),
            include_runs=bool(args.include_runs),
            exclude_names=None,
        )
        log_lines.append("copied transformer_tabular")

    # Optional folders
    if args.include_optional_text_url:
        for d in ["text_threats", "url_threats", "network_threats", "security_stack"]:
            src = repo_root / d
            if src.exists():
                copytree_filtered(src, project_out / d, include_processed=True, include_runs=True, exclude_names=None)
        log_lines.append("copied optional detector folders")

    (out_root / "bundle_log.txt").write_text("\n".join(log_lines) + "\n", encoding="utf-8")

    print(f"Bundle written to: {out_root}")
    print(f"Project copied to: {project_out}")


if __name__ == "__main__":
    main()
