import { Meeting } from '../types';

const STORAGE_KEY = 'mock_meetings';

const getLocalMeetings = (): Meeting[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
};

const saveLocalMeetings = (data: Meeting[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const createMeeting = async (meeting: Meeting) => {
    const items = getLocalMeetings();
    items.push(meeting);
    saveLocalMeetings(items);
    return meeting;
};

export const getMeetingsForUser = async (uid: string, userEmail: string, userCpf?: string): Promise<Meeting[]> => {
    const items = getLocalMeetings();
    return items.filter(m => m.hostUid === uid || m.guestEmail === userEmail);
};

export const deleteMeeting = async (meetingId: string) => {
    const items = getLocalMeetings();
    const filtered = items.filter(m => m.id !== meetingId);
    saveLocalMeetings(filtered);
};

export const restoreLatestCanceledMeeting = async (uid: string) => {
    const items = getLocalMeetings();
    // Encontra a reunião cancelada mais recente criada por este usuário
    const userCanceledMeetings = items
        .filter(m => m.hostUid === uid && m.status === 'canceled')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (userCanceledMeetings.length > 0) {
        const meetingToRestore = userCanceledMeetings[0];
        
        // Atualiza o status
        const updatedItems = items.map(m => {
            if (m.id === meetingToRestore.id) {
                return { ...m, status: 'scheduled' as const };
            }
            return m;
        });
        
        saveLocalMeetings(updatedItems);
        return true;
    }
    return false;
};