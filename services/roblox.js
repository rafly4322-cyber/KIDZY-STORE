const axios = require('axios');
const crypto = require('crypto');

const DATASTORE_NAME = 'SaweriaDonations';
const DATASTORE_KEY = 'AllDonations';

function generateMD5(content) {
    const hash = crypto.createHash('md5');
    hash.update(content);
    return hash.digest('base64');
}

/**
 * Get current DataStore value from Roblox Open Cloud
 */
async function getDataStoreValue(universeId, apiKey, datastoreName = DATASTORE_NAME, entryKey = DATASTORE_KEY) {
    try {
        const url = `https://apis.roblox.com/datastores/v1/universes/${universeId}/standard-datastores/datastore/entries/entry`;
        
        const response = await axios.get(url, {
            params: {
                datastoreName: datastoreName,
                entryKey: entryKey
            },
            headers: {
                'x-api-key': apiKey
            },
            timeout: 12000
        });
        
        return {
            success: true,
            data: response.data,
            version: response.headers['roblox-entry-version']
        };
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return {
                success: true,
                data: [],
                isNew: true
            };
        }
        return {
            success: false,
            error: error.response?.data?.message || error.response?.data || error.message,
            status: error.response?.status
        };
    }
}

/**
 * Set DataStore value in Roblox Open Cloud
 */
async function setDataStoreValue(universeId, apiKey, value, datastoreName = DATASTORE_NAME, entryKey = DATASTORE_KEY) {
    try {
        const url = `https://apis.roblox.com/datastores/v1/universes/${universeId}/standard-datastores/datastore/entries/entry`;
        const jsonString = JSON.stringify(value);
        const md5Hash = generateMD5(jsonString);
        
        const response = await axios.post(url, jsonString, {
            params: {
                datastoreName: datastoreName,
                entryKey: entryKey
            },
            headers: {
                'x-api-key': apiKey,
                'content-type': 'application/json',
                'content-md5': md5Hash,
                'roblox-entry-userids': '[]',
                'roblox-entry-attributes': '{}'
            },
            timeout: 12000
        });
        
        return {
            success: true,
            version: response.data?.version,
            data: response.data
        };
    } catch (error) {
        return {
            success: false,
            error: error.response?.data?.message || error.response?.data || error.message,
            status: error.response?.status
        };
    }
}

/**
 * Save donation to a specific Roblox Universe DataStore
 */
async function saveDonationToUniverse(universeId, apiKey, donationData) {
    if (!universeId || !apiKey) {
        return {
            success: false,
            universeId,
            error: 'Missing Universe ID or Roblox API Key'
        };
    }

    try {
        const getRes = await getDataStoreValue(universeId, apiKey);
        let allDonations = [];

        if (getRes.success && Array.isArray(getRes.data)) {
            allDonations = getRes.data;
        }

        const donorName = donationData.nama || 'Anonymous';
        const donationAmount = parseInt(donationData.amount) || 0;
        const donationMessage = donationData.message || '';
        const donationTimestamp = donationData.timestamp || new Date().toISOString();

        const existingIndex = allDonations.findIndex(d => d.Name === donorName);

        if (existingIndex !== -1) {
            const donor = allDonations[existingIndex];
            donor.Amount = (donor.Amount || 0) + donationAmount;
            
            if (!Array.isArray(donor.Messages)) {
                donor.Messages = [];
            }
            
            donor.Messages.push({
                Message: donationMessage,
                Amount: donationAmount,
                Timestamp: donationTimestamp
            });
            
            donor.DonationCount = donor.Messages.length;
            donor.LastDonation = donationTimestamp;
        } else {
            const newDonor = {
                Name: donorName,
                Amount: donationAmount,
                DonationCount: 1,
                LastDonation: donationTimestamp,
                Messages: [
                    {
                        Message: donationMessage,
                        Amount: donationAmount,
                        Timestamp: donationTimestamp
                    }
                ]
            };
            allDonations.push(newDonor);
        }

        const setRes = await setDataStoreValue(universeId, apiKey, allDonations);

        if (setRes.success) {
            return {
                success: true,
                universeId,
                totalDonors: allDonations.length,
                totalAmount: allDonations.reduce((sum, d) => sum + d.Amount, 0),
                updated: existingIndex !== -1,
                version: setRes.version
            };
        } else {
            return {
                success: false,
                universeId,
                error: setRes.error
            };
        }
    } catch (err) {
        return {
            success: false,
            universeId,
            error: err.message
        };
    }
}

/**
 * Test Roblox Open Cloud Connection
 */
async function testRobloxConnection(universeId, apiKey) {
    if (!universeId || !apiKey) {
        return {
            success: false,
            message: 'Universe ID dan API Key wajib diisi.'
        };
    }

    try {
        const res = await getDataStoreValue(universeId, apiKey);
        if (res.success) {
            return {
                success: true,
                message: 'Koneksi ke Roblox Open Cloud Berhasil!',
                entryCount: Array.isArray(res.data) ? res.data.length : 0,
                data: res.data
            };
        } else {
            return {
                success: false,
                message: `Gagal terhubung ke Roblox: ${typeof res.error === 'object' ? JSON.stringify(res.error) : res.error}`
            };
        }
    } catch (err) {
        return {
            success: false,
            message: `Error koneksi: ${err.message}`
        };
    }
}

module.exports = {
    DATASTORE_NAME,
    DATASTORE_KEY,
    getDataStoreValue,
    setDataStoreValue,
    saveDonationToUniverse,
    testRobloxConnection
};
