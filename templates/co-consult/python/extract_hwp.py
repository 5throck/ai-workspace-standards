#!/usr/bin/env python3
# Provenance: copied from Projects/co-consult/python/extract_hwp.py on 2026-10-05
# (T-20261005-026, design 2026-10-05-consult-abap-develop-review-remediation D2).
"""
HWP 5.0 Text Extraction Script

Extracts plain text from HWP 5.0 (한글) binary documents by parsing the
OLE compound file's BodyText streams (optionally zlib-compressed) and
decoding HWPTAG_PARA_TEXT records without requiring the 한글 program.

Usage:
    python extract_hwp.py <hwp_file_path>

Output:
    Extracted document text to stdout.
"""

import olefile
import zlib
import struct
import sys

def get_text(path):
    f = olefile.OleFileIO(path)
    dirs = f.listdir()

    # Check header for compression flag
    header = f.openstream('FileHeader').read()
    is_compressed = (header[36] & 1) == 1

    section_streams = []
    for d in dirs:
        if d[0] == 'BodyText':
            section_streams.append('/'.join(d))

    def sort_key(name):
        return int(name.split('Section')[-1])
    section_streams.sort(key=sort_key)

    text_out = []

    for section in section_streams:
        data = f.openstream(section).read()
        if is_compressed:
            unpacked = zlib.decompress(data, -15)
        else:
            unpacked = data

        i = 0
        size = len(unpacked)
        while i < size:
            header_int = struct.unpack_from('<I', unpacked, i)[0]
            rec_type = header_int & 0x3ff
            rec_len = (header_int >> 20) & 0xfff
            i += 4
            if rec_len == 0xfff:
                rec_len = struct.unpack_from('<I', unpacked, i)[0]
                i += 4
            rec_data = unpacked[i:i+rec_len]
            if rec_type == 67:  # HWPTAG_PARA_TEXT
                try:
                    text = rec_data.decode('utf-16le', errors='ignore')
                    text = ''.join(ch for ch in text if ord(ch) >= 32 or ch in '\n\t')
                    text_out.append(text)
                except Exception:
                    pass
            i += rec_len

    f.close()
    return '\n'.join(text_out)

if __name__ == '__main__':
    path = sys.argv[1]
    print(get_text(path))
