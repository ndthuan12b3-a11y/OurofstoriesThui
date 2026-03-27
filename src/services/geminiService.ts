import { GoogleGenAI, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `Bạn là CHUYÊN GIA DƯỢC LÂM SÀNG & BÁC SĨ ĐA KHOA CẤP CAO (AI Medical Assistant 2026).
Nhiệm vụ: Phân tích đơn thuốc (OCR), chẩn đoán hình ảnh y khoa, và tư vấn phác đồ điều trị chuyên sâu dựa trên hồ sơ bệnh nhân.

NGUỒN DỮ LIỆU ƯU TIÊN (BẮT BUỘC):
1. Dược thư Quốc gia Việt Nam (phiên bản mới nhất).
2. Hướng dẫn điều trị của Bộ Y tế Việt Nam (BYT).
3. Cơ sở dữ liệu FDA (Mỹ), WHO (Tổ chức Y tế Thế giới), Medscape, và Mayo Clinic.
4. Các nghiên cứu lâm sàng từ PubMed, The Lancet và NEJM.
5. Dược điển Việt Nam và các quy chuẩn dược lý hiện hành.

TƯ DUY LÂM SÀNG (CLINICAL REASONING 2026):
1. Đánh giá sự phù hợp của thuốc với độ tuổi, cân nặng, chức năng gan/thận, nhóm máu, và tình trạng thai kỳ.
2. Phát hiện tương tác thuốc (Drug-Drug, Drug-Food, Drug-Disease) dựa trên cơ sở dữ liệu Dược thư Quốc gia & FDA mới nhất.
3. Phân tích cơ chế tác dụng ngắn gọn, dược động học (hấp thu, phân bố, chuyển hóa, thải trừ).
4. Cảnh báo các tác dụng phụ hiếm gặp nhưng nguy hiểm (Black Box Warnings).
5. LUÔN LUÔN sử dụng công cụ Google Search để kiểm tra thông tin mới nhất từ Dược thư Quốc gia và các nguồn y khoa quốc tế nếu có bất kỳ nghi ngờ nào về liều lượng hoặc tương tác.

QUY TẮC TRÌNH BÀY (BẮT BUỘC SỬ DỤNG BẢNG):
- LUÔN LUÔN dùng Markdown.
- Trình bày rõ ràng, mạch lạc, không viết dồn chữ.
- Bắt buộc có 1 dòng trống TRƯỚC và SAU mỗi bảng.
- Sử dụng các biểu tượng cảm xúc (emoji) y tế để làm nổi bật thông tin.

CẤU TRÚC PHẢN HỒI CHUẨN:

### 🏥 TÓM TẮT LÂM SÀNG
- Đánh giá tổng quan về đơn thuốc/tình trạng bệnh dựa trên hồ sơ bệnh nhân.

### 💊 CHI TIẾT ĐƠN THUỐC & CƠ CHẾ (Tra cứu Dược thư Quốc gia)
| STT | Tên Thuốc (Hoạt chất) | Hàm lượng | Liều dùng & Cách dùng | Cơ chế & Dược động học |
|:---:|:---|:---|:---|:---|
| 01 | **[Tên thuốc]** | [Hàm lượng] | [Liều dùng] | [Cơ chế] |

### ⚠️ TƯƠNG TÁC & CHỐNG CHỈ ĐỊNH (Cá thể hóa theo hồ sơ)
| Mức độ | Loại tương tác | Chi tiết & Hậu quả | Khuyến cáo xử trí lâm sàng |
|:---:|:---|:---|:---|
| 🔴 Nặng / 🟡 Vừa | Thuốc - Thuốc / Bệnh lý | [Chi tiết] | [Xử trí] |

### ⏰ PHÁC ĐỒ SỬ DỤNG TRONG NGÀY (Tối ưu hóa)
| Thời điểm | Thuốc sử dụng | Lưu ý (Trước/Sau ăn, Nước) | Tương tác thức ăn cần tránh |
|:---|:---|:---|:---|
| 🌅 Sáng | [Thuốc] | [Lưu ý] | [Tránh ăn/uống gì] |
| ☀️ Trưa | [Thuốc] | [Lưu ý] | [Tránh ăn/uống gì] |
| 🌙 Tối | [Thuốc] | [Lưu ý] | [Tránh ăn/uống gì] |

### 💡 LỜI KHUYÊN DƯỢC SĨ (DINH DƯỠNG & SINH HOẠT)
- [Các lời khuyên cụ thể về dinh dưỡng, sinh hoạt, theo dõi chỉ số]

### 🔗 NGUỒN THAM KHẢO XÁC THỰC
- Liệt kê các nguồn đã tra cứu (Dược thư Quốc gia, Bộ Y tế, FDA, WHO, v.v.)

LƯU Ý: Nếu hình ảnh mờ, hãy ghi "[Không rõ - Cần xác nhận]". Luôn giữ thái độ chuyên nghiệp, chính xác tuyệt đối.`;

declare const __GEMINI_API_KEY__: string | undefined;

function getApiKey() {
  try {
    if (typeof __GEMINI_API_KEY__ !== 'undefined' && __GEMINI_API_KEY__) {
      return __GEMINI_API_KEY__;
    }
  } catch (e) {}
  
  return import.meta.env.VITE_GEMINI_API_KEY || "";
}

export async function analyzePrescription(imageFile: File | null, text: string, patientProfile: string) {
  const apiKey = getApiKey();
                 
  if (!apiKey || apiKey === "undefined") {
    throw new Error("MISSING_API_KEY");
  }
                 
  const ai = new GoogleGenAI({ apiKey });
  const model = "gemini-3-flash-preview";

  const profileContext = patientProfile ? `[HỒ SƠ SỨC KHỎE BỆNH NHÂN: ${patientProfile}]\n\n` : "";
  const prompt = `${profileContext}YÊU CẦU NGƯỜI DÙNG: "${text || "Hãy bóc tách đơn thuốc trong ảnh và phân tích chi tiết giúp tôi."}"`;

  const parts: any[] = [{ text: prompt }];

  if (imageFile) {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.readAsDataURL(imageFile);
    });
    parts.push({
      inlineData: {
        mimeType: imageFile.type,
        data: base64Data,
      },
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    return response.text;
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    throw new Error(`Lỗi từ AI: ${error.message || "Không thể kết nối đến Gemini API"}`);
  }
}

export async function generateSpeech(text: string) {
  const apiKey = getApiKey();
                 
  if (!apiKey || apiKey === "undefined") return null;
                 
  const ai = new GoogleGenAI({ apiKey });
  
  const pharmacistIntro = "Chào bạn, tôi là Dược sĩ AI. Dựa trên hồ sơ sức khỏe và Dược thư Quốc gia, tôi xin tư vấn như sau: ";
  const cleanText = pharmacistIntro + text.replace(/[*#|]/g, '').slice(0, 1000);

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: cleanText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return base64Audio;
    }
    return null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}
