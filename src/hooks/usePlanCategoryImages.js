import {useEffect, useState} from 'react';
import axios from 'axios';
import server from '../utils/serverConfig';
import Config from '../utils/safeConfig';
import {generateToken} from '../utils/SecurityTokenManager';
import {categoryImagesFromRows} from '../utils/planCategories';

/**
 * Advisor-uploaded category images, keyed by `categoryImageKey(kind, name)`.
 * Display-only: on any failure the map stays empty and variants show their
 * default category icons. See docs/BESPOKE_PLAN_CATEGORIES.md (web repo).
 */
export default function usePlanCategoryImages(headerName, refreshKey) {
    const [images, setImages] = useState({});
    useEffect(() => {
        let cancelled = false;
        if (!headerName) {return undefined;}
        axios
            .get(`${server.server.baseUrl}api/admin/plan-categories`, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Advisor-Subdomain': headerName,
                    'aq-encrypted-key': generateToken(
                        Config?.REACT_APP_AQ_KEYS,
                        Config?.REACT_APP_AQ_SECRET,
                    ),
                },
                timeout: 10000,
            })
            .then(res => {
                if (!cancelled) {setImages(categoryImagesFromRows(res?.data?.data));}
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [headerName, refreshKey]);
    return images;
}
