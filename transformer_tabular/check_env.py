from __future__ import annotations

import torch


def main() -> None:
    print('torch:', torch.__version__)
    print('cuda available:', torch.cuda.is_available())
    if torch.cuda.is_available():
        print('cuda version (torch):', torch.version.cuda)
        print('gpu:', torch.cuda.get_device_name(0))
        print('capability:', torch.cuda.get_device_capability(0))


if __name__ == '__main__':
    main()
