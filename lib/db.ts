import { Auction } from '@/types';
import { supabase } from './supabase';
import fs from 'fs';
import path from 'path';
import { SupabaseClient } from '@supabase/supabase-js';

const DB_PATH = path.join(process.cwd(), 'data', 'auctions.json');

// Helper for local fallback
function getLocalAuctions(): Auction[] {
    try {
        if (!fs.existsSync(DB_PATH)) return [];
        const data = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Local DB error:", e);
        return [];
    }
}

function saveLocalAuction(auction: Auction) {
    const auctions = getLocalAuctions();
    auctions.push(auction);
    if (!fs.existsSync(path.dirname(DB_PATH))) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(auctions, null, 2));
}

export async function getAuctions(): Promise<Auction[]> {
    if (!supabase) return getLocalAuctions();

    const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .order('fecha', { ascending: false });

    if (error) {
        console.error('Error fetching auctions from Supabase:', error);
        return getLocalAuctions();
    }

    return data as Auction[];
}

export async function saveAuction(auction: Auction, authClient?: SupabaseClient) {
    // If we have an authenticated client (from the API route), use it.
    // Otherwise fallback to the public client.
    const client = authClient || supabase;

    if (!client) {
        // Supabase not configured — try local fallback (won't work on Vercel)
        try {
            saveLocalAuction(auction);
        } catch (e) {
            console.error('Local save failed (read-only FS?):', e);
            throw new Error('Supabase no está configurado y el guardado local falló.');
        }
        return;
    }

    let { error } = await client
        .from('auctions')
        .insert([auction]);

    // If the 'summaries' column doesn't exist yet, retry without it
    if (error && error.message?.includes('summaries')) {
        console.warn('summaries column not found, retrying without it');
        const { summaries, ...auctionWithoutSummaries } = auction;
        const result = await client.from('auctions').insert([auctionWithoutSummaries]);
        error = result.error;
    }

    if (error) {
        console.error('Error saving auction to Supabase:', error);
        throw new Error(`Error al guardar en base de datos: ${error.message}`);
    }
}

export async function deleteAuction(id: string, authClient?: SupabaseClient) {
    const client = authClient || supabase;

    if (!client) {
        let auctions = getLocalAuctions();
        auctions = auctions.filter(a => a.id !== id);
        fs.writeFileSync(DB_PATH, JSON.stringify(auctions, null, 2));
        return;
    }

    const { error } = await client
        .from('auctions')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting auction from Supabase:', error);
        throw error;
    }
}

export async function getAuctionById(id: string): Promise<Auction | undefined> {
    if (!supabase) {
        return getLocalAuctions().find(a => a.id === id);
    }

    const { data, error } = await supabase
        .from('auctions')
        .select('*')
        .eq('id', id)
        .single();

    if (error) {
        console.error('Error fetching auction by id from Supabase:', error);
        return getLocalAuctions().find(a => a.id === id);
    }

    return data as Auction;
}
