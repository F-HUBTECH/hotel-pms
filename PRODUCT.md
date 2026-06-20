# Product

## Register

product

## Users

พนักงานโรงแรมในประเทศไทย — ตั้งแต่พนักงาน front desk, แคชเชียร์, แม่บ้าน ไปจนถึงผู้จัดการและผู้ดูแลระบบ แบ่งเป็น 4 ระดับ role:

- **Staff**: พนักงานปฏิบัติการ — ทำงานซ้ำ ๆ ต่อเนื่อง (check-in/out, รับชำระเงิน, ดูห้องว่าง)
- **Manager**: หัวหน้างาน — ดูแลทีม, จัดการ rate plan, ดูรายงาน
- **Admin**: ผู้ดูแลระบบ — ตั้งค่า master data, จัดการ user, กำหนดสิทธิ์
- **Super Admin**: เจ้าของ/ผู้บริหารสูงสุด — เข้าถึงทุกส่วน

ผู้ใช้ทุกคนทำงานภายใต้แรงกดดันด้านเวลา (แขกรอเช็คอิน, คิวคิดเงิน) — ความเร็วและความแม่นยำคือสิ่งสำคัญที่สุด

## Product Purpose

ระบบจัดการโรงแรม (Property Management System) สำหรับตลาดประเทศไทย — รองรับการจองห้องพัก, เช็คอิน/เช็คเอาท์, จัดการบิลและชำระเงิน, ใบกำกับภาษีอิเล็กทรอนิกส์, คำนวณ VAT/Service Charge, Night Audit, Housekeeping, Forecasting, และรายงาน

ความสำเร็จวัดจาก:
- ลดเวลาทำรายการต่อแขกหนึ่งคน
- ลดข้อผิดพลาดจากการคำนวณภาษี/ค่าบริการ
- พนักงานเรียนรู้ระบบได้เร็ว ใช้งานได้ทันที

## Brand Personality

**Professional, efficient, trustworthy**

- **Professional**: เชื่อถือได้ ถูกต้องแม่นยำ — ทุกรายการทางการเงินตรวจสอบได้
- **Efficient**: เร็ว ตรงไปตรงมา — ไม่มีขั้นตอนที่ไม่จำเป็น ข้อมูลอยู่แค่เอื้อม
- **Trustworthy**: ปลอดภัย โปร่งใส — ระบบบัญชีที่ตรวจสอบได้, สิทธิ์การเข้าถึงที่รัดกุม

Voice: ตรงไปตรงมา, ให้ข้อมูล, เป็นกลาง — ไม่การตลาด, ไม่เล่นคำ, ไม่เวิ่นเว้อ

## Anti-references

ยังไม่ได้ระบุ — จะเพิ่มเติมหลังจากการใช้งานจริง

## Design Principles

1. **Speed over decoration** — ทุก element ต้องตอบคำถาม "ช่วยให้ทำงานเร็วขึ้นไหม" ถ้าไม่ — ตัดออก
2. **Clarity at a glance** — ข้อมูลสำคัญ (สถานะห้อง, ยอดเงิน, ภาษี) ต้องเห็นได้ทันที ไม่ต้องค้นหา
3. **Forgive mistakes** — ทุกการกระทำที่ทำแล้วย้อนกลับไม่ได้ต้องยืนยัน; การแก้ไขย้อนหลังต้องมี audit trail
4. **Familiar patterns survive pressure** — ใช้ pattern ที่พนักงานเคยเห็นจากระบบอื่น (ปุ่มตำแหน่งเดิม, workflow เดียวกัน) — ลด cognitive load
5. **Hierarchy through density, not decoration** — ข้อมูลเยอะได้ แต่ต้องจัดลำดับความสำคัญด้วย spacing, weight, และตำแหน่ง — ไม่ใช่สีและ decoration

## Accessibility & Inclusion

- WCAG 2.1 Level AA เป็นมาตรฐานขั้นต่ำ
- ทุกส่วนต้องทำงานด้วย keyboard navigation
- Contrast ratio ≥ 4.5:1 สำหรับ body text, ≥ 3:1 สำหรับ large text
- Screen reader รองรับผ่าน semantic HTML และ ARIA labels
- Motion ต้องมี reduced-motion fallback
