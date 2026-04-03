import { useEffect, useState } from 'react';

export const useAuth = () => {
    const [currentUsername, setCurrentUsername] = useState<string | null | undefined>(undefined);
    const [authError, setAuthError] = useState(false);

    useEffect(() => {
        import('../api/auth').then(({ api }) => {
            api.post('/auth/verify')
                .then((res) => {
                    const user = res.data?.User || res.data;
                    setCurrentUsername(user?.username || null);
                })
                .catch(() => setCurrentUsername(null));
        });
    }, []);

    return { currentUsername, authError, setAuthError };
};
