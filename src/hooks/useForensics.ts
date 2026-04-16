import { db } from '../lib/db/schema';

export const useForensics = () => {
    // 1. Is this a trending 2026 tech item?
    const isTrending = (tags: string[] = []) => {
       const trendKeywords = ['qi2', 'gan', 'ows', 'smart ring', 'iphone 17', 'iphone 18'];
       return tags.some(t => trendKeywords.some(keyword => t.toLowerCase().includes(keyword)));
    };

    // 2. Fetch Phantom Inventory Anomalies across all regions for Admin
    const detectPhantomInventory = async (isAdmin: boolean, localShopId?: string) => {
        const products = await db.products.toArray();
        const salesQueue = await db.sales_queue.toArray(); 
        
        // Admins sweep global ecosystem; Managers sweep only local
        if (!isAdmin && !localShopId) return [];

        const stockToCheck = isAdmin 
           ? await db.inventory.toArray()
           : await db.inventory.where('shopId').equals(localShopId).toArray();

        // Hardcoding dictionary resolver for the Dashboard Alert UI
        const mockShops: Record<string, string> = {
            'shop_1': 'Nairobi Central',
            'shop_2': 'Mombasa Road',
            'shop_3': 'Kisumu West',
            'shop_4': 'Nakuru East',
            'shop_5': 'Eldoret Hub',
            'warehouse': 'Main Warehouse'
        };

        const alerts: any[] = [];

        for (const stock of stockToCheck) {
            const p = products.find(prod => prod.id === stock.productId);
            if (!p) continue;
            
            // Forensics trigger: current_stock > 5 AND sales_last_48h === 0 AND High Velocity Tech
            if (stock.qty > 5 && isTrending(p.tags)) {
                const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
                
                const recSales = salesQueue.filter(s => {
                    return s.timestamp > fortyEightHoursAgo && 
                           s.payload?.items?.some((i: any) => i.productId === p.id);
                });

                if (recSales.length === 0) {
                    alerts.push({
                        id: Math.random().toString(36).substring(2),
                        productId: p.id,
                        name: p.name,
                        shopName: mockShops[stock.shopId] || 'Unknown Origin',
                        stockCount: stock.qty,
                        lostRevenueKsh: stock.qty * p.basePrice, // KSh potential loss
                        trendStatus: 'HIGH'
                    });
                }
            }
        }
        return alerts;
    };

    return { isTrending, detectPhantomInventory };
};
