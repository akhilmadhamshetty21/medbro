import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface Medicine {
  id: string;
  medicine: string;
  dosage: string;
  frequency: string;
  times: string;
  duration: string;
}

export interface Prescription {
  id: string;
  label: string;
  createdAt: string;
  imageUri?: string;
  medicines: Medicine[];
}

const STORAGE_KEY = '@medbro_prescriptions';

export function usePrescriptions() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((data) => {
        if (data) setPrescriptions(JSON.parse(data));
      })
      .finally(() => setLoading(false));
  }, []);

  async function save(updated: Prescription[]) {
    setPrescriptions(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  const addPrescription = useCallback(
    async (medicines: Medicine[], imageUri?: string) => {
      const now = new Date();
      const label = `Prescription — ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      const entry: Prescription = {
        id: Date.now().toString(),
        label,
        createdAt: now.toISOString(),
        imageUri,
        medicines,
      };
      await save([entry, ...prescriptions]);
      return entry;
    },
    [prescriptions]
  );

  const addMedicineToPrescription = useCallback(
    async (prescriptionId: string, medicine: Medicine) => {
      const updated = prescriptions.map((p) =>
        p.id === prescriptionId ? { ...p, medicines: [...p.medicines, medicine] } : p
      );
      await save(updated);
    },
    [prescriptions]
  );

  const removeMedicine = useCallback(
    async (prescriptionId: string, medicineId: string) => {
      const updated = prescriptions.map((p) =>
        p.id === prescriptionId
          ? { ...p, medicines: p.medicines.filter((m) => m.id !== medicineId) }
          : p
      );
      await save(updated);
    },
    [prescriptions]
  );

  const deletePrescription = useCallback(
    async (id: string) => {
      await save(prescriptions.filter((p) => p.id !== id));
    },
    [prescriptions]
  );

  const renamePrescription = useCallback(
    async (id: string, label: string) => {
      const updated = prescriptions.map((p) => (p.id === id ? { ...p, label } : p));
      await save(updated);
    },
    [prescriptions]
  );

  return {
    prescriptions,
    loading,
    addPrescription,
    addMedicineToPrescription,
    removeMedicine,
    deletePrescription,
    renamePrescription,
  };
}
