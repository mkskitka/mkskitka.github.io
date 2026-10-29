#!/bin/sh
# Export the resume (or the CV) to PDF with headless Chrome (A4, no margins,
# colours kept). Usage:
#   sh scripts/resume-pdf.sh [out.pdf] [dark|light] [source.html]
# Defaults: ~/Desktop/MK_Skitka_Resume_<month_day>.pdf, dark, resume/resume.html.
# The CV: sh scripts/resume-pdf.sh ~/Desktop/MK_Skitka_CV.pdf dark resume/cv.html
set -e
cd "$(dirname "$0")/.."
OUT="${1:-$HOME/Desktop/MK_Skitka_Resume_$(date +%m_%d).pdf}"
THEME="${2:-dark}"
FILE="${3:-resume/resume.html}"
SRC="file://$PWD/$FILE"
[ "$THEME" = "light" ] && SRC="$SRC?theme=light"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --disable-gpu --no-pdf-header-footer \
  --virtual-time-budget=8000 --run-all-compositor-stages-before-draw \
  --print-to-pdf="$OUT" "$SRC" 2>/dev/null
echo "wrote $OUT"
