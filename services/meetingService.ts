import { db } from './firebase';
import { 
  collection, doc, setDoc, deleteDoc, 
  query, where, getDocs, orderBy
} from 'firebase/firestore';
import { Meeting } from '../types';

const MEETINGS_COLLECTION = 'reunioes';

export const createMeeting = async (meeting: Meeting) => {
    try {
        await setDoc(doc(db, MEETINGS_COLLECTION, meeting.id), meeting);
        return meeting;
    } catch (error) {
        console.error("Erro ao criar reunião:", error);
        throw error;
    }
};

export const getMeetingsForUser = async (uid: string, userEmail: string, userCpf?: string): Promise<Meeting[]> => {
    try {
        const meetings: Meeting[] = [];
        
        // 1. Buscas onde sou o anfitrião
        const qHost = query(collection(db, MEETINGS_COLLECTION), where("hostUid", "==", uid));
        const hostSnap = await getDocs(qHost);
        hostSnap.forEach(doc => meetings.push(doc.data() as Meeting));

        // 2. Buscas onde sou convidado pelo email
        if (userEmail) {
            const qGuestEmail = query(collection(db, MEETINGS_COLLECTION), where("guestEmail", "==", userEmail));
            const guestEmailSnap = await getDocs(qGuestEmail);
            // Evitar duplicatas se o ID já existir
            guestEmailSnap.forEach(doc => {
                if (!meetings.find(m => m.id === doc.id)) {
                    meetings.push(doc.data() as Meeting);
                }
            });
        }

        // 3. Buscas onde sou convidado pelo CPF
        if (userCpf) {
            const cleanCpf = userCpf.replace(/\D/g, '');
            const qGuestCpf = query(collection(db, MEETINGS_COLLECTION), where("guestCpf", "==", cleanCpf));
            const guestCpfSnap = await getDocs(qGuestCpf);
            guestCpfSnap.forEach(doc => {
                if (!meetings.find(m => m.id === doc.id)) {
                    meetings.push(doc.data() as Meeting);
                }
            });
        }

        return meetings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
        console.error("Erro ao buscar reuniões:", error);
        return [];
    }
};

export const deleteMeeting = async (meetingId: string) => {
    try {
        await deleteDoc(doc(db, MEETINGS_COLLECTION, meetingId));
    } catch (error) {
        console.error("Erro ao deletar reunião:", error);
    }
};

export const restoreLatestCanceledMeeting = async (uid: string) => {
    try {
        const q = query(
            collection(db, MEETINGS_COLLECTION), 
            where("hostUid", "==", uid),
            where("status", "==", "canceled")
        );
        
        const querySnapshot = await getDocs(q);
        const canceledMeetings: Meeting[] = [];
        
        querySnapshot.forEach(doc => canceledMeetings.push(doc.data() as Meeting));
        
        // Ordena para pegar a mais recente
        canceledMeetings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (canceledMeetings.length > 0) {
            const meetingToRestore = canceledMeetings[0];
            const docRef = doc(db, MEETINGS_COLLECTION, meetingToRestore.id);
            await setDoc(docRef, { status: 'scheduled' }, { merge: true });
            return true;
        }
        return false;
    } catch (error) {
        console.error("Erro ao restaurar reunião:", error);
        return false;
    }
};