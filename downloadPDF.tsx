import jsPDF from "jspdf";
import html2canvas from "html2canvas";
 
export async function downloadResumePDF(
  elementId: string,
  filename: string = "resume"
): Promise<void> {
  const element = document.getElementById(elementId);
 
  if (!element) {
    console.error(`Element #${elementId} not found`);
    alert("Resume element not found. Please try again.");
    return;
  }
 
  try {
    // Show loading state — call this from your component
    console.log("📄 Generating PDF...");
 
    // Capture the element as a canvas
    const canvas = await html2canvas(element, {
      scale: 2,               // high resolution
      useCORS: true,          // allow external fonts/images
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      onclone: (clonedDoc) => {
        const oklchToRgb = (lStr: string, cStr: string, hStr: string, aStr?: string): string => {
          try {
            let l = parseFloat(lStr);
            if (lStr.includes("%")) l = l / 100;
            let c = parseFloat(cStr);
            if (cStr.includes("%")) c = c / 100;
            let h = parseFloat(hStr);
            let a = 1;
            if (aStr) {
              if (aStr.endsWith("%")) {
                a = parseFloat(aStr) / 100;
              } else {
                a = parseFloat(aStr);
              }
            }

            if (isNaN(l)) l = 0;
            if (isNaN(c)) c = 0;
            if (isNaN(h)) h = 0;
            if (isNaN(a)) a = 1;

            const hRad = (h * Math.PI) / 180;
            const oklabL = l;
            const oklabA = c * Math.cos(hRad);
            const oklabB = c * Math.sin(hRad);

            const l_ = oklabL + 0.3963377774 * oklabA + 0.2158037573 * oklabB;
            const m_ = oklabL - 0.1055613458 * oklabA - 0.0638541728 * oklabB;
            const s_ = oklabL - 0.0894841775 * oklabA - 1.2914855480 * oklabB;

            const l3 = l_ * l_ * l_;
            const m3 = m_ * m_ * m_;
            const s3 = s_ * s_ * s_;

            const rL = +4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
            const gL = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
            const bL = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.7076147010 * s3;

            const toSRGB = (x: number) => {
              return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
            };

            const r = Math.round(Math.max(0, Math.min(1, toSRGB(rL))) * 255);
            const g = Math.round(Math.max(0, Math.min(1, toSRGB(gL))) * 255);
            const b = Math.round(Math.max(0, Math.min(1, toSRGB(bL))) * 255);

            return a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;
          } catch (err) {
            console.error("oklchToRgb conversion error:", err);
            return "rgb(0,0,0)";
          }
        };

        const styleElements = clonedDoc.querySelectorAll("style");
        styleElements.forEach((styleEl) => {
          let cssText = styleEl.innerHTML;
          if (cssText.includes("oklch")) {
            const replaced = cssText.replace(
              /oklch\(\s*([\d\.-]+%?)(?:\s*,\s*|\s+)([\d\.-]+%?)(?:\s*,\s*|\s+)([\d\.-]+%?)(?:\s*(?:,|\/)\s*([\d\.-]+%?))?\s*\)/gi,
              (match, lStr, cStr, hStr, aStr) => {
                return oklchToRgb(lStr, cStr, hStr, aStr);
              }
            );
            styleEl.innerHTML = replaced;
          }
        });

        const styledElements = clonedDoc.querySelectorAll("[style]");
        styledElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          let styleAttr = htmlEl.getAttribute("style") || "";
          if (styleAttr.includes("oklch")) {
            const replaced = styleAttr.replace(
              /oklch\(\s*([\d\.-]+%?)(?:\s*,\s*|\s+)([\d\.-]+%?)(?:\s*,\s*|\s+)([\d\.-]+%?)(?:\s*(?:,|\/)\s*([\d\.-]+%?))?\s*\)/gi,
              (match, lStr, cStr, hStr, aStr) => {
                return oklchToRgb(lStr, cStr, hStr, aStr);
              }
            );
            htmlEl.setAttribute("style", replaced);
          }
        });
      },
    });
 
    const imgData = canvas.toDataURL("image/jpeg", 0.98);
 
    // A4 dimensions in mm
    const PDF_WIDTH  = 210;
    const PDF_HEIGHT = 297;
    const MARGIN     = 10;
 
    const usableWidth  = PDF_WIDTH  - MARGIN * 2;
    const usableHeight = PDF_HEIGHT - MARGIN * 2;
 
    // Calculate how many pages we need
    const imgWidth  = usableWidth;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;
 
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
 
    let heightLeft = imgHeight;
    let position   = MARGIN;
    let pageNumber = 0;
 
    // First page
    pdf.addImage(imgData, "JPEG", MARGIN, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
 
    // Additional pages if resume is long
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + MARGIN;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", MARGIN, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
      pageNumber++;
    }
 
    // Save with candidate name in filename
    const safeName = filename
      .replace(/[^a-z0-9\s-]/gi, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
 
    pdf.save(`${safeName || "resume"}-voicecv.pdf`);
    console.log("✅ PDF downloaded");
 
  } catch (err: any) {
    console.error("PDF generation error:", err);
    alert("PDF generation failed. Please try again.");
  }
}
