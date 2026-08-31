--[[
    ========================================================================
    KIDZY STORE — ROBLOX LIVE CHAT & BROADCAST SERVER (2-WAY BRIDGE)
    Versi: 3.0.0 (2026 Edition)
    Menghubungkan Web Admin Langsung ke Player In-Game Realtime
    ========================================================================
]]

local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TextChatService = game:GetService("TextChatService")

-- ========================================================================
-- KONFIGURASI GATEWAY
-- ========================================================================
local CONFIG = {
    -- URL Server Backend Vercel kamu
    SERVER_URL = "https://kidzy-store.vercel.app",
    
    -- Interval polling pesan dari Admin (detik)
    POLL_INTERVAL = 2.5,
    
    -- Apakah meneruskan semua chat player ke Web Admin (true/false)
    -- Jika false, player hanya diteruskan jika mengetik /help <pesan> atau /ask <pesan>
    SEND_ALL_CHATS = true,
    
    -- Prefix khusus jika hanya ingin meneruskan chat tertentu
    CHAT_PREFIX = "/ask"
}

local UNIVERSE_ID = tostring(game.GameId)
local PLACE_ID = tostring(game.PlaceId)

print(string.format("💬 [KIDZY LIVE CHAT] Mengaktifkan Live Chat Bridge (Universe ID: %s)", UNIVERSE_ID))

-- ========================================================================
-- 1. FUNGSI BROADCAST PESAN ADMIN KE SEMUA PLAYER IN-GAME
-- ========================================================================
local function BroadcastAdminMessage(sender, text, isBroadcast, targetPlayerName)
    local formattedSender = sender or "👑 KIDZY (Owner)"
    local messageContent = string.format("[BROADCAST] %s: %s", formattedSender, text)

    print(string.format("📢 [ADMIN CHAT INCOMING] %s: %s", formattedSender, text))

    -- 1. Kirim via TextChatService (Roblox Modern Chat)
    pcall(function()
        local textChannels = TextChatService:FindFirstChild("TextChannels")
        if textChannels then
            local general = textChannels:FindFirstChild("RBXGeneral")
            if general then
                general:DisplaySystemMessage(string.format("<font color='#FBBF24'><b>%s</b></font>: <font color='#FFFFFF'>%s</font>", formattedSender, text))
            end
        end
    end)

    -- 2. Kirim via Legacy Chat System (Fallback)
    pcall(function()
        local chatEvents = ReplicatedStorage:FindFirstChild("DefaultChatSystemChatEvents")
        if chatEvents then
            local sayMsg = chatEvents:FindFirstChild("SayMessageRequest")
            if sayMsg then
                -- Broadcast ke client
            end
        end
    end)

    -- 3. Visual Pop-up Alert Banner untuk Player
    for _, player in ipairs(Players:GetPlayers()) do
        if targetPlayerName == "all" or targetPlayerName == player.Name or isBroadcast then
            task.spawn(function()
                local playerGui = player:FindFirstChildOfClass("PlayerGui")
                if playerGui then
                    -- Buat atau gunakan banner notifikasi chat broadcast
                    local bannerGui = playerGui:FindFirstChild("KidzyAdminChatBanner")
                    if not bannerGui then
                        bannerGui = Instance.new("ScreenGui")
                        bannerGui.Name = "KidzyAdminChatBanner"
                        bannerGui.ResetOnSpawn = false
                        bannerGui.Parent = playerGui
                    end

                    local frame = Instance.new("Frame")
                    frame.Size = UDim2.new(0, 420, 0, 70)
                    frame.Position = UDim2.new(0.5, -210, 0, 20)
                    frame.BackgroundColor3 = Color3.fromRGB(15, 18, 30)
                    frame.BackgroundTransparency = 0.1
                    frame.BorderSizePixel = 0
                    frame.Parent = bannerGui

                    local uiCorner = Instance.new("UICorner")
                    uiCorner.CornerRadius = UDim.new(0, 10)
                    uiCorner.Parent = frame

                    local uiStroke = Instance.new("UIStroke")
                    uiStroke.Color = Color3.fromRGB(245, 158, 11)
                    uiStroke.Thickness = 1.5
                    uiStroke.Parent = frame

                    local titleLbl = Instance.new("TextLabel")
                    titleLbl.Size = UDim2.new(1, -20, 0, 22)
                    titleLbl.Position = UDim2.new(0, 10, 0, 8)
                    titleLbl.BackgroundTransparency = 1
                    titleLbl.Font = Enum.Font.GothamBold
                    titleLbl.TextSize = 13
                    titleLbl.TextColor3 = Color3.fromRGB(251, 191, 36)
                    titleLbl.TextXAlignment = Enum.TextXAlignment.Left
                    titleLbl.Text = string.format("👑 %s", formattedSender)
                    titleLbl.Parent = frame

                    local msgLbl = Instance.new("TextLabel")
                    msgLbl.Size = UDim2.new(1, -20, 0, 32)
                    msgLbl.Position = UDim2.new(0, 10, 0, 30)
                    msgLbl.BackgroundTransparency = 1
                    msgLbl.Font = Enum.Font.GothamMedium
                    msgLbl.TextSize = 14
                    msgLbl.TextColor3 = Color3.fromRGB(255, 255, 255)
                    msgLbl.TextWrapped = true
                    msgLbl.TextXAlignment = Enum.TextXAlignment.Left
                    msgLbl.Text = text
                    msgLbl.Parent = frame

                    -- Auto fade out setelah 6 detik
                    task.delay(6, function()
                        if frame and frame.Parent then
                            frame:Destroy()
                        end
                    end)
                end
            end)
        end
    end
end

-- ========================================================================
-- 2. LISTENER CHAT PLAYER IN-GAME -> KIRIM KE WEB ADMIN
-- ========================================================================
local function OnPlayerChatted(player, message)
    if not message or #message == 0 then return end

    -- Cek jika pesan menggunakan prefix atau jika SEND_ALL_CHATS aktif
    local shouldSend = CONFIG.SEND_ALL_CHATS
    local cleanText = message

    if message:sub(1, #CONFIG.CHAT_PREFIX) == CONFIG.CHAT_PREFIX then
        shouldSend = true
        cleanText = message:sub(#CONFIG.CHAT_PREFIX + 1):match("^%s*(.-)%s*$")
    end

    if not shouldSend or #cleanText == 0 then return end

    task.spawn(function()
        local payload = {
            playerName = player.Name,
            playerId = player.UserId,
            text = cleanText,
            universeId = UNIVERSE_ID,
            placeId = PLACE_ID,
            messageType = "in_game_chat"
        }

        local jsonBody = HttpService:JSONEncode(payload)
        local url = CONFIG.SERVER_URL .. "/api/chat/from-game"

        pcall(function()
            HttpService:PostAsync(url, jsonBody, Enum.HttpContentType.ApplicationJson, false)
            print(string.format("📤 [PLAYER CHAT FORWARDED] %s: %s", player.Name, cleanText))
        end)
    end)
end

Players.PlayerAdded:Connect(function(player)
    player.Chatted:Connect(function(message)
        OnPlayerChatted(player, message)
    end)
end)

for _, player in ipairs(Players:GetPlayers()) do
    player.Chatted:Connect(function(message)
        OnPlayerChatted(player, message)
    end)
end

-- ========================================================================
-- 3. BACKGROUND POLLING LOOP: AMBIL PESAN ADMIN DARI WEB
-- ========================================================================
task.spawn(function()
    while true do
        task.wait(CONFIG.POLL_INTERVAL)
        
        local success, result = pcall(function()
            local pollUrl = string.format("%s/api/chat/poll-game/%s", CONFIG.SERVER_URL, UNIVERSE_ID)
            local responseJson = HttpService:GetAsync(pollUrl, true)
            return HttpService:JSONDecode(responseJson)
        end)

        if success and result and result.success and result.messages and #result.messages > 0 then
            for _, msg in ipairs(result.messages) do
                BroadcastAdminMessage(msg.sender, msg.text, msg.isBroadcast, msg.targetPlayer)
            end
        end
    end
end)

print("✅ [KIDZY LIVE CHAT] Server script berhasil berjalan dan siap menghubungkan Web ⟷ Game Roblox!")
