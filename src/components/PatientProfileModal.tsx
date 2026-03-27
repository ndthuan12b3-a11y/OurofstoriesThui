import React from 'react';
import { IdCard, Save } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface PatientProfile {
  age: string;
  weight: string;
  renalHepatic: string;
  allergy: string;
  conditions: string;
  bloodType: string;
  currentMeds: string;
  pregnancyStatus: string;
}

interface PatientProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: PatientProfile;
  setProfile: React.Dispatch<React.SetStateAction<PatientProfile>>;
  onSave: () => void;
}

export const PatientProfileModal: React.FC<PatientProfileModalProps> = ({
  isOpen,
  onClose,
  profile,
  setProfile,
  onSave,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hồ sơ sức khỏe (2026)"
      icon={IdCard}
      footer={
        <Button
          onClick={onSave}
          className="w-full bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white shadow-lg shadow-sky-200"
          icon={Save}
        >
          Lưu hồ sơ
        </Button>
      }
    >
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-hide">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Tuổi</label>
            <input 
              type="number" 
              value={profile.age}
              onChange={(e) => setProfile(prev => ({ ...prev, age: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all" 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Cân nặng (kg)</label>
            <input 
              type="number" 
              value={profile.weight}
              onChange={(e) => setProfile(prev => ({ ...prev, weight: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all" 
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Nhóm máu</label>
            <select
              value={profile.bloodType}
              onChange={(e) => setProfile(prev => ({ ...prev, bloodType: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all"
            >
              <option value="">Chưa rõ</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Thai kỳ / Cho con bú</label>
            <select
              value={profile.pregnancyStatus}
              onChange={(e) => setProfile(prev => ({ ...prev, pregnancyStatus: e.target.value }))}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm transition-all"
            >
              <option value="Không">Không</option>
              <option value="Đang mang thai">Đang mang thai</option>
              <option value="Đang cho con bú">Đang cho con bú</option>
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Tiền sử dị ứng thuốc</label>
          <textarea 
            value={profile.allergy}
            onChange={(e) => setProfile(prev => ({ ...prev, allergy: e.target.value }))}
            rows={2} 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" 
            placeholder="Ví dụ: Penicillin, Aspirin..."
          ></textarea>
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Chức năng Gan / Thận</label>
          <input 
            type="text" 
            value={profile.renalHepatic}
            onChange={(e) => setProfile(prev => ({ ...prev, renalHepatic: e.target.value }))}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" 
            placeholder="Ví dụ: Bình thường, hoặc suy thận độ 2..." 
          />
        </div>
        
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Bệnh lý nền</label>
          <textarea 
            value={profile.conditions}
            onChange={(e) => setProfile(prev => ({ ...prev, conditions: e.target.value }))}
            rows={2} 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" 
            placeholder="Ví dụ: Cao huyết áp, Dạ dày..."
          ></textarea>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 tracking-wider">Thuốc đang sử dụng</label>
          <textarea 
            value={profile.currentMeds}
            onChange={(e) => setProfile(prev => ({ ...prev, currentMeds: e.target.value }))}
            rows={2} 
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" 
            placeholder="Liệt kê các thuốc đang dùng để AI kiểm tra tương tác..."
          ></textarea>
        </div>
      </div>
    </Modal>
  );
};
