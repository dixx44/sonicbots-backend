"use client";

import React, { useEffect, useState, useRef, useMemo, Suspense } from "react";
import { io, Socket } from "socket.io-client";
import { X, Dices, RotateCcw, UserPlus, Send, Copy, Bot, MessageSquare, ShieldAlert, LogOut, ChevronLeft, Zap, Gamepad2 } from "lucide-react";
import CryptoJS from 'crypto-js';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Text, Float, RoundedBox } from '@react-three/drei';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { motion } from 'framer-motion';

interface LudoGameProps { username: string; onBack: () => void; pendingAgents?: string[]; initialRoomId?: string | null; }

const COLORS = ["#ef4444", "#22c55e", "#eab308", "#3b82f6"];
const SECRET_KEY = "AURA_NEURAL_STRIKE_2024";

const globalPath = [
    [-1, 6], [-1, 5], [-1, 4], [-1, 3], [-1, 2], [-2, 1], [-3, 1], [-4, 1], [-5, 1], [-6, 1], [-7, 1],
    [-7, 0], [-7, -1], [-6, -1], [-5, -1], [-4, -1], [-3, -1], [-2, -1], [-1, -2], [-1, -3], [-1, -4], [-1, -5], [-1, -6], [-1, -7],
    [0, -7], [1, -7], [1, -6], [1, -5], [1, -4], [1, -3], [1, -2], [2, -1], [3, -1], [4, -1], [5, -1], [6, -1], [7, -1],
    [7, 0], [7, 1], [6, 1], [5, 1], [4, 1], [3, 1], [2, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7],
    [0, 7], [-1, 7]
];

const getCoord = (playerIdx: number, relPos: number, pieceIdx: number) => {
    if (relPos === -1) {
        const bases = [
            [[-5, 5], [-4, 5], [-5, 4], [-4, 4]],       // Red
            [[-5, -5], [-4, -5], [-5, -4], [-4, -4]],   // Green
            [[4, -5], [5, -5], [4, -4], [5, -4]],       // Yellow
            [[4, 5], [5, 5], [4, 4], [5, 4]]            // Blue
        ];
        return bases[playerIdx][pieceIdx];
    } else if (relPos >= 52 && relPos <= 56) {
        const step = relPos - 51;
        if (playerIdx === 0) return [0, 7 - step];
        if (playerIdx === 1) return [-7 + step, 0];
        if (playerIdx === 2) return [0, -7 + step];
        if (playerIdx === 3) return [7 - step, 0];
    } else if (relPos >= 57) {
        return [playerIdx === 1 ? -0.5 : playerIdx === 3 ? 0.5 : 0, playerIdx === 0 ? 0.5 : playerIdx === 2 ? -0.5 : 0];
    } else {
        const globalPos = (relPos + [0, 13, 26, 39][playerIdx]) % 52;
        return globalPath[globalPos];
    }
    return [0, 0];
};

const LudoBoard = ({ boardSkin }: any) => {
    const bgColor = boardSkin === 'space' ? '#0a0a2a' : boardSkin === 'matrix' ? '#001a00' : boardSkin === 'gold' ? '#2a1a00' : '#050810';
    const tileColor = boardSkin === 'gold' ? '#4a3a1a' : '#1a2436';

    const tiles = useMemo(() => {
        const t = [];
        globalPath.forEach((coord, i) => {
            let color = tileColor;
            if (i === 0) color = COLORS[0];
            if (i === 13) color = COLORS[1];
            if (i === 26) color = COLORS[2];
            if (i === 39) color = COLORS[3];
            const safeSpots = [0, 8, 13, 21, 26, 34, 39, 47];
            if (safeSpots.includes(i) && color === tileColor) color = boardSkin === 'gold' ? '#5a4a2a' : '#2a3b5c';
            t.push({ x: coord[0], y: coord[1], color, isSafe: safeSpots.includes(i), isCenter: false });
        });
        for (let i = 1; i <= 5; i++) {
            t.push({ x: 0, y: 7 - i, color: COLORS[0], isSafe: true, isCenter: false });
            t.push({ x: -7 + i, y: 0, color: COLORS[1], isSafe: true, isCenter: false });
            t.push({ x: 0, y: -7 + i, color: COLORS[2], isSafe: true, isCenter: false });
            t.push({ x: 7 - i, y: 0, color: COLORS[3], isSafe: true, isCenter: false });
        }
        t.push({ x: 0, y: 0, color: "#ffffff", isSafe: true, isCenter: true });
        const bases = [
            { x: -4.5, y: 4.5, color: COLORS[0] }, { x: -4.5, y: -4.5, color: COLORS[1] },
            { x: 4.5, y: -4.5, color: COLORS[2] }, { x: 4.5, y: 4.5, color: COLORS[3] },
        ];
        return { tiles: t, bases };
    }, [tileColor, boardSkin]);

    return (
        <group>
            <mesh position={[0, -0.5, 0]} receiveShadow>
                <boxGeometry args={[16, 1, 16]} />
                <meshStandardMaterial color={bgColor} roughness={0.8} />
            </mesh>
            {tiles.bases.map((base, i) => (
                <group key={`base-${i}`} position={[base.x, 0.05, base.y]}>
                    <mesh receiveShadow>
                        <boxGeometry args={[6, 0.2, 6]} />
                        <meshStandardMaterial color={base.color} roughness={0.2} metalness={0.8} transparent opacity={0.3} />
                    </mesh>
                    <mesh position={[0, 0, 0]}>
                        <boxGeometry args={[6.2, 0.1, 6.2]} />
                        <meshBasicMaterial color={base.color} wireframe />
                    </mesh>
                    {[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].map((pos, j) => (
                        <mesh key={j} position={[pos[0] / 3, 0.1, pos[1] / 3]} rotation={[-Math.PI / 2, 0, 0]}>
                            <circleGeometry args={[0.8, 32]} />
                            <meshStandardMaterial color="#ffffff" transparent opacity={0.1} />
                        </mesh>
                    ))}
                    <Text position={[0, 0.5, 0]} fontSize={0.6} color="#ffffff" anchorX="center" anchorY="middle" rotation={[-Math.PI / 2, 0, 0]} fillOpacity={0.8}>
                        {['RE-ENTRY', 'CYBER-SYNC', 'CORE-LINK', 'DATA-BLUE'][i]}
                    </Text>
                </group>
            ))}
            {tiles.tiles.map((tile, i) => (
                <mesh key={`tile-${i}`} position={[tile.x, 0.05, tile.y]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.9, 0.9]} />
                    <meshStandardMaterial
                        color={tile.color}
                        roughness={0.1}
                        metalness={0.5}
                        emissive={tile.isSafe ? tile.color : "#000000"}
                        emissiveIntensity={tile.isSafe ? 0.3 : 0}
                    />
                </mesh>
            ))}
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} castShadow />
        </group>
    );
};

const Token = ({ playerIdx, pieceIdx, pos, isMyTurn, onClick, isMine, canMove, skin }: any) => {
    const meshRef = useRef<THREE.Group>(null);
    const coord = getCoord(playerIdx, pos, pieceIdx);

    useEffect(() => {
        if (meshRef.current) {
            meshRef.current.position.set(coord[0], 0, coord[1]);
        }
    }, []);

    useGSAP(() => {
        if (!meshRef.current) return;
        const dx = meshRef.current.position.x - coord[0];
        const dz = meshRef.current.position.z - coord[1];
        if (Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1) {
            playSound('move');
            gsap.to(meshRef.current.position, { x: coord[0], z: coord[1], duration: 0.5, ease: "power2.inOut" });
            gsap.to(meshRef.current.position, { y: 2, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.out" });
        }
    }, [coord[0], coord[1]]);

    const isActive = isMine && isMyTurn && pos !== 57;
    const isHighlight = isActive && canMove;

    return (
        <group ref={meshRef} onClick={onClick}>
            <mesh position={[0, skin === 'button' ? 0.2 : (skin === 'diamond' ? 0.6 : 0.5), 0]} castShadow receiveShadow>
                {skin === 'sphere' ? <sphereGeometry args={[0.4, 32, 32]} /> :
                    skin === 'cube' ? <boxGeometry args={[0.6, 0.6, 0.6]} /> :
                        skin === 'pyramid' ? <coneGeometry args={[0.4, 0.8, 4]} /> :
                            skin === 'button' ? <cylinderGeometry args={[0.5, 0.5, 0.3, 32]} /> :
                                skin === 'diamond' ? <octahedronGeometry args={[0.5]} /> :
                                    skin === 'ghost' ? <sphereGeometry args={[0.3, 16, 16]} /> :
                                        <cylinderGeometry args={[0.3, 0.4, 1, 32]} />
                }
                <meshStandardMaterial
                    color={COLORS[playerIdx]}
                    roughness={skin === 'ghost' ? 0 : 0.1}
                    metalness={skin === 'ghost' ? 0 : 0.8}
                    transparent={skin === 'ghost'}
                    opacity={skin === 'ghost' ? 0.4 : 1}
                    emissive={isHighlight ? "#ffffff" : (isActive ? COLORS[playerIdx] : "#000000")}
                    emissiveIntensity={isHighlight ? 1 : (isActive ? 0.5 : 0)}
                />
            </mesh>
            {isHighlight && (
                <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.6, 0.8, 32]} />
                    <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
                </mesh>
            )}
        </group>
    );
};

const DiceDots = ({ count }: { count: number }) => {
    const dotPos: any = {
        1: [[0, 0]],
        2: [[-0.4, -0.4], [0.4, 0.4]],
        3: [[-0.4, -0.4], [0, 0], [0.4, 0.4]],
        4: [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]],
        5: [[-0.4, -0.4], [0.4, -0.4], [0, 0], [-0.4, 0.4], [0.4, 0.4]],
        6: [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0], [0.4, 0], [-0.4, 0.4], [0.4, 0.4]]
    };
    return (
        <group>
            {dotPos[count]?.map((pos: any, i: number) => (
                <mesh key={i} position={[pos[0], pos[1], 0.76]}>
                    <circleGeometry args={[0.12, 32]} />
                    <meshBasicMaterial color="#000000" />
                </mesh>
            ))}
        </group>
    );
};

const Dice3D = ({ value, rolling, onClick, isMyTurn, color }: any) => {
    const meshRef = useRef<THREE.Group>(null);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (rolling) {
            setAnimating(true);
            playSound('roll');
            setTimeout(() => setAnimating(false), 600);
        }
    }, [rolling]);

    useGSAP(() => {
        if (!meshRef.current) return;
        if (animating) {
            gsap.to(meshRef.current.rotation, { x: "+=15", y: "+=15", z: "+=15", duration: 0.6, ease: "power2.inOut" });
            gsap.to(meshRef.current.position, { y: 4, duration: 0.3, yoyo: true, repeat: 1, ease: "power1.out" });
        } else {
            const rots: any = {
                1: [0, 0, 0],
                2: [-Math.PI / 2, 0, 0],
                3: [0, Math.PI / 2, 0],
                4: [0, -Math.PI / 2, 0],
                5: [Math.PI / 2, 0, 0],
                6: [Math.PI, 0, 0]
            };
            const targetRot = rots[value || 1];
            gsap.to(meshRef.current.rotation, { x: targetRot[0], y: targetRot[1], z: targetRot[2], duration: 0.4, ease: "back.out(1.7)" });
        }
    }, [animating, value]);

    return (
        <Float speed={2} rotationIntensity={isMyTurn && !animating && !rolling ? 0.5 : 0} floatIntensity={isMyTurn && !animating && !rolling ? 2 : 0}>
            <group ref={meshRef} position={[0, 1.2, 0]} onClick={onClick}>
                <RoundedBox args={[1.5, 1.5, 1.5]} radius={0.15} smoothness={4}>
                    <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.05} transparent opacity={0.6} />
                </RoundedBox>
                {/* 1: Top */}
                <group rotation={[-Math.PI / 2, 0, 0]}><DiceDots count={1} /></group>
                {/* 6: Bottom */}
                <group rotation={[Math.PI / 2, 0, 0]}><DiceDots count={6} /></group>
                {/* 2: Front */}
                <group rotation={[0, 0, 0]}><DiceDots count={2} /></group>
                {/* 5: Back */}
                <group rotation={[0, Math.PI, 0]}><DiceDots count={5} /></group>
                {/* 3: Left */}
                <group rotation={[0, -Math.PI / 2, 0]}><DiceDots count={3} /></group>
                {/* 4: Right */}
                <group rotation={[0, Math.PI / 2, 0]}><DiceDots count={4} /></group>
            </group>
        </Float>
    );
};

export const playSound = (type: 'roll' | 'move' | 'capture' | 'win') => {
    const urls = {
        roll: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
        move: 'https://assets.mixkit.co/active_storage/sfx/2578/2578-preview.mp3',
        capture: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
        win: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3'
    };
    if (typeof window !== 'undefined') {
        try { new Audio(urls[type]).play().catch(() => { }); } catch (e) { }
    }
};

export default function NeuralGameWorld({ username, onBack, initialRoomId, socket, wallet = 0, pendingAgents, negotiationTarget, clearNegotiationTarget }: any) {
    const [gameState, setGameState] = useState<any>(null);
    const [gameError, setGameError] = useState<string | null>(null);
    const [joinCode, setJoinCode] = useState(initialRoomId || "");
    const [chatMsg, setChatMsg] = useState("");
    const [messages, setMessages] = useState<any[]>([]);
    const [events, setEvents] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [sentInvites, setSentInvites] = useState<any[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const [loadingSlots, setLoadingSlots] = useState<number[]>([]);
    const previousPlayersRef = useRef<any[]>([]);
    const [walletInfo, setWalletInfo] = useState<any>({
        wallet: 0,
        history: [],
        inventory: { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' }
    });
    const inventory = walletInfo?.inventory || { tokens: ['standard'], boards: ['classic'], selectedToken: 'standard', selectedBoard: 'classic' };
    const [showWalletHistory, setShowWalletHistory] = useState(false);
    const [activeNegotiationChat, setActiveNegotiationChat] = useState<string | null>(null);
    const [activeNegotiationChatName, setActiveNegotiationChatName] = useState("");
    const [privateMessages, setPrivateMessages] = useState<any[]>([]);
    const [privateChatInput, setPrivateChatInput] = useState("");
    const [typingStatus, setTypingStatus] = useState<string | null>(null);
    const [showBetSlip, setShowBetSlip] = useState(false);
    const [readyButtonId, setReadyButtonId] = useState<number | null>(null);
    const prevBetRef = useRef(0);
    const [transactionPopup, setTransactionPopup] = useState<{ type: 'debit' | 'credit', amount: number, message: string } | null>(null);
    const [showBonusPopup, setShowBonusPopup] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [showStakes, setShowStakes] = useState(false);
    const [deployPhase, setDeployPhase] = useState<'idle' | 'deploying' | 'starting'>('idle');
    const [deployPlayers, setDeployPlayers] = useState<any[]>([]);

    const normalizeAgentName = (agent: any) => {
        if (typeof agent === 'string') return agent;
        if (agent?.username) return agent.username;
        if (agent?.name) return agent.name;
        return 'Agent';
    };

    const getDeployBotNames = (agents: any[]) => {
        const normalized = (agents || []).slice(0, 3).map(normalizeAgentName);
        return [
            normalized[0] || 'NeuralNinja',
            normalized[1] || 'Pixel_Surge',
            normalized[2] || 'CodeDrake'
        ];
    };

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const checkMobile = () => setIsMobile(window.innerWidth < 1024);
            checkMobile();
            window.addEventListener('resize', checkMobile);
            return () => window.removeEventListener('resize', checkMobile);
        }
    }, []);

    useEffect(() => {
        if (negotiationTarget) {
            setActiveNegotiationChat(negotiationTarget.id);
            setActiveNegotiationChatName(negotiationTarget.username || "Agent");
            if (clearNegotiationTarget) clearNegotiationTarget();
        }
    }, [negotiationTarget]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, privateMessages]);

    useEffect(() => {
        if (!socket) return;

        socket.on('ludo_state', setGameState);
        socket.on('ludo_room_created', (data: any) => setGameState(data.state));
        socket.on('ludo_joined', (data: any) => setGameState(data.state));
        socket.on('ludo_player_joined', (data: any) => setGameState(data.state));
        socket.on('ludo_started', (data: any) => setGameState(data.state));
        socket.on('ludo_kicked', () => { onBack(); });
        socket.on('ludo_chat_msg', (msg: any) => setMessages((p: any) => [...p, msg]));
        socket.on('update_users', setOnlineUsers);
        socket.on('ludo_event', (ev: any) => {
            if (ev.type === 'capture') playSound('capture');
            else if (ev.type === 'win') playSound('win');
            else if (ev.type === 'move') playSound('move');
            else if (ev.type === 'join') {
                setSentInvites((p: any) => p.filter((u: any) => u.username !== ev.playerName));
            }
            setEvents((p: any) => [...p, ev]);
            setTimeout(() => setEvents((p: any) => p.slice(1)), 4000);
        });

        socket.on('ludo_error', (err: any) => {
            setGameError(String(err));
            setEvents((p: any) => [...p, { message: `⚠️ ${err}`, isError: true }]);
            setTimeout(() => setEvents((p: any) => p.slice(1)), 3000);
        });

        socket.emit('get_wallet');
        socket.on('wallet_update', setWalletInfo);
        socket.on('ludo_transaction', (data: any) => {
            playSound(data.type === 'credit' ? 'win' : 'capture');
            setTransactionPopup(data);
            setTimeout(() => setTransactionPopup(null), 3000);
        });

        socket.emit('get_users');
        if (initialRoomId) {
            socket.emit('ludo_get_state', { roomId: initialRoomId });
            socket.emit('ludo_join', { roomId: initialRoomId, name: username });
        }

        return () => {
            socket.off('ludo_state');
            socket.off('ludo_room_created');
            socket.off('ludo_joined');
            socket.off('ludo_player_joined');
            socket.off('ludo_started');
            socket.off('ludo_kicked');
            socket.off('ludo_chat_msg');
            socket.off('ludo_event');
            socket.off('ludo_error');
            socket.off('wallet_update');
            socket.off('ludo_transaction');
        };
    }, [socket, initialRoomId, username, onBack]);

    // Community lobby deploy — auto-sync and launch
    useEffect(() => {
        if (!initialRoomId?.startsWith('AURA-') || !socket) return;

        // If this is a private invite game, do NOT auto-add bots
        if (pendingAgents && pendingAgents.length > 0) {
            setDeployPhase('deploying');
            const invited = pendingAgents.map((a: any) => ({ name: normalizeAgentName(a), status: 'pending' }));
            setDeployPlayers([
                { name: 'You', status: 'syncing' },
                ...invited
            ]);

            // Create the real game room
            socket.emit('ludo_create', { name: username, roomId: initialRoomId });

            // Sync host instantly
            setTimeout(() => {
                setDeployPlayers(p => p.map((pl, i) => i === 0 ? { ...pl, status: 'synced' } : pl));
            }, 1000);

            return;
        }

        // Retrieve the simulated agent names and keep display names synced
        const botNames = getDeployBotNames(pendingAgents);

        setDeployPhase('deploying');
        setDeployPlayers([
            { name: 'You', status: 'syncing' },
            { name: botNames[0], status: 'pending' },
            { name: botNames[1], status: 'pending' },
            { name: botNames[2], status: 'pending' }
        ]);

        // Immediately create a real game room on the server with the initial AURA- roomId
        socket.emit('ludo_create', { name: username, roomId: initialRoomId });

        setTimeout(() => {
            setDeployPlayers(p => p.map((pl, i) => i === 0 ? { ...pl, status: 'synced' } : pl));
        }, 1500);

        // Simulate players joining the server room by adding them as bots one by one
        const t1 = setTimeout(() => {
            setDeployPlayers(p => p.map((pl, i) => i === 1 ? { ...pl, name: botNames[0], status: 'synced' } : pl));
            socket.emit('ludo_add_bot', { name: botNames[0] });
        }, 3000);

        const t2 = setTimeout(() => {
            setDeployPlayers(p => p.map((pl, i) => i === 2 ? { ...pl, name: botNames[1], status: 'synced' } : pl));
            socket.emit('ludo_add_bot', { name: botNames[1] });
        }, 6000);

        const t3 = setTimeout(() => {
            setDeployPlayers(p => p.map((pl, i) => i === 3 ? { ...pl, name: botNames[2], status: 'synced' } : pl));
            socket.emit('ludo_add_bot', { name: botNames[2] });
        }, 9000);

        // Auto start the match from host at 11.5s
        const t4 = setTimeout(() => {
            setDeployPhase('starting');
        }, 10500);

        const t5 = setTimeout(() => {
            setDeployPhase('idle');
            socket.emit('ludo_start');
        }, 11500);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
            clearTimeout(t5);
        };
    }, [initialRoomId, socket, pendingAgents]);

    // Real-time synchronization of invited players joining the room
    useEffect(() => {
        if (deployPhase === 'deploying' && gameState?.players && pendingAgents && pendingAgents.length > 0) {
            setDeployPlayers(prev => {
                return prev.map((p, i) => {
                    if (i === 0) return { ...p, status: 'synced' };
                    const gp = gameState.players.find((x: any) => x.name.toLowerCase() === p.name.toLowerCase());
                    if (gp) {
                        return { ...p, status: 'synced' };
                    }
                    return p;
                });
            });
        }
    }, [gameState?.players, deployPhase, pendingAgents]);

    // Automatically trigger match start when all invited players are synced
    useEffect(() => {
        if (deployPhase === 'deploying' && pendingAgents && pendingAgents.length > 0 && deployPlayers.length >= 2) {
            const allSynced = deployPlayers.every(p => p.status === 'synced');
            if (allSynced) {
                setDeployPhase('starting');
                const t = setTimeout(() => {
                    setDeployPhase('idle');
                    socket?.emit('ludo_start');
                }, 3000);
                return () => clearTimeout(t);
            }
        }
    }, [deployPlayers, deployPhase, pendingAgents, socket]);


    // Countdown sound synchronization
    useEffect(() => {
        if (gameState?.state === 'starting' && gameState?.countdown !== undefined && gameState?.countdown !== null) {
            playSound('roll');
        }
    }, [gameState?.countdown, gameState?.state]);



    useEffect(() => {
        if (gameState?.betAmount > 0 && gameState.betAmount !== prevBetRef.current) {
            prevBetRef.current = gameState.betAmount;
        }
    }, [gameState?.betAmount]);

    useEffect(() => {
        if (!socket) return;
        const handleMessage = (msg: any) => {
            if (msg.senderId && (msg.senderId === activeNegotiationChat || msg.targetId === activeNegotiationChat)) {
                let dec = msg.text;
                if (msg.isEncrypted) {
                    try {
                        const bytes = CryptoJS.AES.decrypt(msg.text, SECRET_KEY);
                        dec = bytes.toString(CryptoJS.enc.Utf8);
                    } catch (e) { }
                }
                if (msg.isLudoReady && !msg.isUser) {
                    setShowBetSlip(true);
                    setTimeout(() => {
                        setShowBetSlip(false);
                        setReadyButtonId(msg.id);
                    }, 3000);
                }
                setPrivateMessages(p => [...p, { ...msg, text: dec }]);
            }
        };
        socket.on('receive_message', handleMessage);

        socket.on('negotiation_history', (history: any[]) => {
            setPrivateMessages(history);
            const readyMsg = history.find(m => m.isLudoReady);
            if (readyMsg) setReadyButtonId(readyMsg.id);
        });

        socket.on('typing_start', (data: any) => { if (data.senderId === activeNegotiationChat) setTypingStatus("Thinking..."); });
        socket.on('typing_end', () => setTypingStatus(null));
        return () => {
            socket.off('receive_message', handleMessage);
            socket.off('negotiation_history');
            socket.off('typing_start');
            socket.off('typing_end');
        };
    }, [socket, activeNegotiationChat]);

    useEffect(() => {
        if (socket && activeNegotiationChat) {
            socket.emit("get_negotiation_history", { targetId: activeNegotiationChat });
        }
    }, [socket, activeNegotiationChat]);

    useEffect(() => {
        if (showInviteModal) {
            setInviteLoading(true);
            setTimeout(() => setInviteLoading(false), 3000);
        }
    }, [showInviteModal]);

    useEffect(() => {
        if (gameState?.players) {
            const newPlayers = gameState.players;
            const oldPlayers = previousPlayersRef.current;
            if (newPlayers.length > oldPlayers.length && gameState.state === 'waiting') {
                const index = newPlayers.length - 1;
                setLoadingSlots(p => [...p, index]);
                setTimeout(() => {
                    setLoadingSlots(p => p.filter(i => i !== index));
                }, 3000);
            }
            previousPlayersRef.current = newPlayers;
        }
    }, [gameState?.players, gameState?.state]);

    const sendPrivateChat = (text: string, rawText?: string) => {
        if (!socket || !activeNegotiationChat) return;
        const encryptedText = CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
        socket.emit("send_message", {
            text: encryptedText,
            decryptedTextForAi: rawText || text,
            targetId: activeNegotiationChat
        });
    };

    const handleCreate = () => socket?.emit('ludo_create', { name: username });
    const handleJoin = () => { if (joinCode) socket?.emit('ludo_join', { roomId: joinCode, name: username }); };
    const handleStart = () => {
        if (gameState && gameState.betAmount > walletInfo.wallet) {
            setEvents(p => [...p, { message: "❌ INSUFFICIENT BALANCE FOR THIS STAKE!", isError: true }]);
            playSound('capture');
            setTimeout(() => setEvents(p => p.slice(1)), 3000);
            return;
        }
        if (gameState?.betAmount > 0) {
            setShowBetSlip(true);
            setTimeout(() => {
                setShowBetSlip(false);
                socket?.emit('ludo_start');
            }, 3000);
        } else {
            socket?.emit('ludo_start');
        }
    };
    const handleRollDice = () => { socket?.emit('ludo_roll'); };
    const handleMovePiece = (pieceIdx: number) => { socket?.emit('ludo_move', { pieceIdx }); };
    const handleReset = () => socket?.emit('ludo_reset');

    const [isClapPlayActive, setIsClapPlayActive] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    const dataArrayRef = useRef<any>(null);
    const clapReqRef = useRef<number | null>(null);

    const gameStateRef = useRef(gameState);
    useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

    const getMovablePieces = () => {
        const currentGameState = gameStateRef.current;
        const currentMyPlayerIdx = currentGameState?.players?.findIndex((p: any) => p.name === username) ?? -1;
        if (!currentGameState || currentGameState.state !== 'playing' || currentGameState.turn !== currentMyPlayerIdx || !currentGameState.diceRolled) return [];
        const myPieces = currentGameState.pieces[currentMyPlayerIdx] || [];
        const dice = currentGameState.dice || 0;
        return myPieces.map((pos: number, pieceIdx: number) => {
            const canMove = pos === -1 ? (dice === 6 || dice === 1) : (pos + dice <= 57);
            return canMove ? pieceIdx : -1;
        }).filter((idx: number) => idx !== -1);
    };

    const toggleClapPlay = async () => {
        if (isClapPlayActive) {
            stopClapDetection();
            setIsClapPlayActive(false);
            setEvents(p => [...p, { message: "🎙️ CLAP PLAY SYSTEM DISABLED", isError: false }]);
            setTimeout(() => setEvents(p => p.slice(1)), 3000);
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStreamRef.current = stream;
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioCtx;
                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 256;
                analyserRef.current = analyser;
                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);
                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                dataArrayRef.current = dataArray;

                setIsClapPlayActive(true);
                setEvents(p => [...p, { message: "🎙️ CLAP SENSOR ON! CLAP TO PLAY LUDO!", isError: false }]);
                playSound('roll');
                setTimeout(() => setEvents(p => p.slice(1)), 4000);

                let historyBuffer: number[] = [];
                const historyLength = 50;
                let lastClapTime = 0;
                let isSpikeActive = false;
                let spikeStartTime = 0;
                let spikePeakLevel = 0;

                const checkAudio = () => {
                    if (!analyserRef.current || !dataArrayRef.current) return;
                    analyserRef.current.getByteFrequencyData(dataArrayRef.current);

                    let sum = 0;
                    for (let i = 0; i < dataArrayRef.current.length; i++) {
                        sum += dataArrayRef.current[i];
                    }
                    const average = sum / dataArrayRef.current.length;
                    const level = Math.min(100, (average / 150) * 100);

                    historyBuffer.push(average);
                    if (historyBuffer.length > historyLength) {
                        historyBuffer.shift();
                    }
                    const avgHistory = historyBuffer.length > 0
                        ? historyBuffer.reduce((a, b) => a + b, 0) / historyBuffer.length
                        : 1;

                    const now = Date.now();
                    const isCurrentlyLoud = level > 35 && (average > avgHistory * 1.8 || level > 45);

                    if (isCurrentlyLoud) {
                        if (!isSpikeActive) {
                            isSpikeActive = true;
                            spikeStartTime = now;
                            spikePeakLevel = level;
                        } else {
                            if (level > spikePeakLevel) {
                                spikePeakLevel = level;
                            }
                        }
                    } else {
                        if (isSpikeActive) {
                            const spikeDuration = now - spikeStartTime;
                            isSpikeActive = false;

                            if (spikeDuration >= 10 && spikeDuration <= 250 && now - lastClapTime > 300) {
                                lastClapTime = now;

                                const currentGameState = gameStateRef.current;
                                const currentMyPlayerIdx = currentGameState?.players?.findIndex((p: any) => p.name === username) ?? -1;

                                if (currentGameState && currentGameState.state === 'playing' && currentGameState.turn === currentMyPlayerIdx) {
                                    if (!currentGameState.diceRolled) {
                                        setEvents(p => [...p, { message: "🎙️ CLAP DETECTED: ROLLING DICE! 🎲", isError: false }]);
                                        setTimeout(() => setEvents(p => p.slice(1)), 3000);
                                        playSound('roll');
                                        socket?.emit('ludo_roll');
                                    } else {
                                        const movable = getMovablePieces();
                                        if (movable.length > 0) {
                                            const pieceToMove = movable[0];
                                            setEvents(p => [...p, { message: `🎙️ CLAP DETECTED: MOVING TOKEN ${pieceToMove + 1}! ⚡`, isError: false }]);
                                            setTimeout(() => setEvents(p => p.slice(1)), 3000);
                                            playSound('move');
                                            socket?.emit('ludo_move', { pieceIdx: pieceToMove });
                                        } else {
                                            setEvents(p => [...p, { message: "❌ NO VALID MOVES FOR YOUR CLAP!", isError: true }]);
                                            setTimeout(() => setEvents(p => p.slice(1)), 3000);
                                            playSound('capture');
                                        }
                                    }
                                } else {
                                    setEvents(p => [...p, { message: "🎙️ CLAP SENSOR READY (WAITING FOR YOUR TURN)", isError: false }]);
                                    setTimeout(() => setEvents(p => p.slice(1)), 2500);
                                }
                            }
                        }
                    }

                    if (audioContextRef.current?.state === "running") {
                        clapReqRef.current = requestAnimationFrame(checkAudio);
                    }
                };
                checkAudio();
            } catch (e) {
                console.error(e);
                setEvents(p => [...p, { message: "❌ MICROPHONE ACCESS DENIED FOR CLAP SENSOR", isError: true }]);
                setTimeout(() => setEvents(p => p.slice(1)), 3000);
            }
        }
    };

    const stopClapDetection = () => {
        if (clapReqRef.current) cancelAnimationFrame(clapReqRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
        }
        audioContextRef.current = null;
        analyserRef.current = null;
        micStreamRef.current = null;
        dataArrayRef.current = null;
    };

    useEffect(() => {
        return () => {
            stopClapDetection();
        };
    }, []);
    const sendChat = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMsg.trim()) return;
        socket?.emit('ludo_chat', { text: chatMsg });
        setChatMsg("");
    };
    const inviteUser = (targetId: string, status: string) => {
        if (status === 'offline') {
            setEvents(p => [...p, { message: "❌ Cannot invite offline nodes!", isError: true }]);
            setTimeout(() => setEvents(p => p.slice(1)), 3000);
            const el = document.getElementById(`invite-row-${targetId}`);
            if (el) { el.classList.add('animate-[shake_0.5s_ease-in-out]'); setTimeout(() => el.classList.remove('animate-[shake_0.5s_ease-in-out]'), 500); }
            return;
        }
        if (gameState?.betAmount > 0 && gameState?.players?.length >= 2) {
            setEvents(p => [...p, { message: "⚠️ Only 2 players allowed in betting matches!", isError: true }]);
            setTimeout(() => setEvents(p => p.slice(1)), 3000);
            return;
        }
        if (gameState?.players?.length >= 4) {
            setEvents(p => [...p, { message: "⚠️ Room is full (4/4 players)!", isError: true }]);
            setTimeout(() => setEvents(p => p.slice(1)), 3000);
            return;
        }
        socket?.emit('ludo_invite_user', { targetId: targetId });

        const targetUser = onlineUsers.find(u => u.id === targetId);
        if (targetUser && !sentInvites.find(i => i.id === targetId)) {
            setSentInvites(p => [...p, targetUser]);
        }
        setShowInviteModal(false);
        setActiveNegotiationChat(targetId);
        setActiveNegotiationChatName(targetUser?.username || "Agent");
        setPrivateMessages([]);

    };
    const copyInviteLink = () => {
        if (gameState?.roomId) {
            navigator.clipboard.writeText(`${window.location.origin}?ludo_room=${gameState.roomId}`);
            setEvents(p => [...p, { message: "Invite link copied to clipboard!" }]);
            setTimeout(() => setEvents(p => p.slice(1)), 3000);
        }
    };

    const myPlayerIdx = gameState?.players?.findIndex((p: any) => p.name === username) ?? -1;

    if (deployPhase !== 'idle') {
        const countdown = gameState?.countdown ?? null;
        return (
            <div className="w-full h-full bg-[#050810] flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent animate-pulse" />
                </div>
                <button onClick={onBack} className="absolute top-6 left-6 z-50 px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500 text-white text-xs font-mono uppercase tracking-wider border border-white/10 transition-all">✕ EXIT</button>
                <div className="text-center mb-10">
                    <p className="text-emerald-400/60 font-mono text-xs uppercase tracking-[0.3em] mb-3">Aura Neural Grid</p>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 tracking-tighter uppercase mb-2">
                        {deployPhase === 'starting' ? '⚡ Launching...' : 'Deploying Grid'}
                    </h1>
                    <p className="text-gray-500 font-mono text-[11px]">Room: {initialRoomId} · {deployPlayers.filter(p => p.status === 'synced').length}/4 players synced</p>
                    <div className="flex gap-2 justify-center mt-3">
                        {deployPlayers.map((p, i) => (
                            <div key={i} className={`w-3 h-3 rounded-full transition-all duration-700 ${p.status === 'synced' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'bg-white/15 animate-pulse'}`} />
                        ))}
                    </div>
                </div>
                <div className="w-full max-w-md space-y-3 px-4">
                    {deployPlayers.map((player, i) => (
                        <div key={i} className={`flex items-center gap-4 px-5 py-3 rounded-2xl border transition-all duration-700 ${player.status === 'synced' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/3 border-white/5 opacity-40'
                            }`}>
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${player.status === 'synced' ? 'bg-emerald-400' : 'bg-gray-600 animate-pulse'}`} />
                            <img src={String(player.avatar || "").startsWith("data:image") ? player.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${player.name === 'You' ? username : player.name}`} className="w-9 h-9 rounded-full border border-white/10" />
                            <div className="flex-1">
                                <p className="text-white font-black font-mono text-sm">{player.name === 'You' ? `${username} (You)` : player.name}</p>
                                <p className={`text-[9px] font-mono ${player.status === 'synced' ? 'text-emerald-400' : 'text-gray-600 animate-pulse'}`}>
                                    {player.status === 'synced' ? '✓ NEURAL SYNC COMPLETE' : '⟳ Connecting to grid...'}
                                </p>
                            </div>
                            {player.status === 'synced' && <span className="text-[9px] text-emerald-400 font-black font-mono bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 rounded-lg">READY</span>}
                        </div>
                    ))}
                </div>
                {/* Countdown */}
                {countdown !== null && (
                    <div className="mt-10 flex flex-col items-center gap-3">
                        {countdown > 0 ? (
                            <>
                                <div className="w-28 h-28 rounded-full border-4 border-emerald-500 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.6)] animate-pulse">
                                    <span className="text-7xl font-black text-emerald-400 font-mono">{countdown}</span>
                                </div>
                                <p className="text-gray-500 font-mono text-xs uppercase tracking-widest">Game starts in {countdown}...</p>
                            </>
                        ) : (
                            <div className="text-5xl font-black text-emerald-400 font-mono tracking-widest animate-bounce">
                                🚀 START!
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    if (!gameState || (!gameState.roomId && gameState.state !== 'playing')) {
        return (
            <div className="w-full h-full min-h-[420px] bg-[#050810] text-white flex flex-col items-center justify-center relative p-6 overflow-hidden">
                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="w-10 h-10 rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                    <p className="text-emerald-400 font-mono text-sm uppercase tracking-widest">
                        {gameError || 'Connecting to the Ludo grid...'}
                    </p>
                    {gameError && (
                        <button onClick={onBack} className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-xs uppercase">
                            Back to Lobby
                        </button>
                    )}
                </div>


                {showBonusPopup && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-500">
                        <motion.div initial={{ opacity: 0, scale: 0.8, y: 50 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="bg-[#0c1222] p-12 rounded-[3.5rem] border-2 border-emerald-500/30 max-w-md w-full text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent"></div>
                            <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30 animate-bounce">
                                <Zap className="w-12 h-12 text-emerald-400 fill-emerald-400" />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-[0.2em] mb-2">Neural Reward</h2>
                            <p className="text-emerald-500/50 font-mono text-xs tracking-[0.3em] mb-8 uppercase">Aura Grid Initialization Bonus</p>

                            <div className="bg-white/5 border border-white/10 p-6 rounded-3xl mb-8 group hover:border-emerald-500/30 transition-all cursor-default">
                                <p className="text-5xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">+15,000</p>
                                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.3em] mt-2">Neural Credits (LKR)</p>
                            </div>

                            <button
                                onClick={() => {
                                    setIsClaiming(true);
                                    playSound('win');
                                    socket?.emit('claim_welcome_bonus');
                                    setTimeout(() => {
                                        setIsClaiming(false);
                                        setShowBonusPopup(false);
                                    }, 1500);
                                }}
                                disabled={isClaiming}
                                className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900/50 text-black font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center justify-center gap-3 relative group overflow-hidden"
                            >
                                <div className={`absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ${isClaiming ? 'hidden' : ''}`}></div>
                                {isClaiming ? (
                                    <>
                                        <div className="w-5 h-5 border-3 border-black/30 border-t-black rounded-full animate-spin"></div>
                                        <span className="animate-pulse">Transferring...</span>
                                    </>
                                ) : (
                                    <>CLAIM REWARD <Zap className="w-4 h-4 fill-black" /></>
                                )}
                            </button>
                        </motion.div>
                    </div>
                )}
                <div className="absolute inset-0 opacity-20 pointer-events-none">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent animate-pulse"></div>
                </div>
                <button onClick={onBack} className="absolute top-8 left-8 z-50 p-4 rounded-2xl bg-white/5 hover:bg-emerald-500 hover:text-black text-white transition-all border border-white/10 flex items-center gap-2 font-black uppercase text-xs tracking-widest shadow-xl group"><X className="w-5 h-5 group-hover:rotate-90 transition-all" /> EXIT SYSTEM</button>
                <div className="absolute top-8 right-8 z-50">
                    <button onClick={() => setShowWalletHistory(!showWalletHistory)} className="bg-[#0c1222] border border-amber-500/30 px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:bg-[#162032] transition-all">
                        <span className="text-gray-500 text-xs font-mono uppercase tracking-widest">WALLET</span>
                        <span className="text-amber-400 font-black text-xl">{walletInfo?.wallet || 0} LKR</span>
                    </button>
                    {showWalletHistory && (
                        <div className="absolute top-16 right-0 w-80 bg-[#0c1222]/95 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[60] animate-in slide-in-from-top-4 duration-300">
                            <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/5">
                                <h3 className="text-amber-400 font-black text-sm uppercase tracking-[0.2em]">Transaction Log</h3>
                                <div className="text-[10px] text-gray-500 font-mono">NEURAL_LEDGER_V3</div>
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                                {walletInfo?.history?.length > 0 ? walletInfo.history.map((h: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-white text-xs font-bold uppercase">{h.reason}</p>
                                            <p className="text-[9px] text-gray-500 font-mono">{new Date(h.date).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-black text-sm ${h.type === 'cash_in' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {h.type === 'cash_in' ? '+' : '-'}{h.amount}
                                            </p>
                                            <p className={`text-[8px] font-black uppercase tracking-widest ${h.type === 'cash_in' ? 'text-emerald-500/50' : 'text-red-500/50'}`}>
                                                {h.type === 'cash_in' ? 'Credit' : 'Debit'}
                                            </p>
                                        </div>
                                    </div>
                                )) : <div className="text-center py-8 text-gray-600 font-mono text-xs italic">No neural transactions found.</div>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-center mb-12">
                    <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 mb-4 tracking-tighter drop-shadow-[0_0_30px_rgba(52,211,153,0.3)] uppercase">NEURAL GRID</h1>
                    <p className="text-gray-400 max-w-lg mx-auto">Tactical multiplayer simulation. Play against friends via real-time connections.</p>
                </div>
                <div className="flex gap-8 w-full max-w-4xl">
                    <div className="flex-1 bg-[#0c1222] border border-white/5 p-8 rounded-3xl text-center hover:border-emerald-500/30 transition-all cursor-pointer" onClick={handleCreate}>
                        <Dices className="w-10 h-10 text-emerald-400 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold text-white mb-2">Host Session</h2>
                        <p className="text-gray-500 text-sm mb-8">Create a new encrypted room.</p>
                        <button className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">CREATE ROOM</button>
                    </div>
                    <div className="flex-1 bg-[#0c1222] border border-white/5 p-8 rounded-3xl text-center hover:border-cyan-500/30 transition-all">
                        <UserPlus className="w-10 h-10 text-cyan-400 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold text-white mb-2">Join Link</h2>
                        <p className="text-gray-500 text-sm mb-8">Enter an existing room code.</p>
                        <div className="flex gap-2">
                            <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="ROOM CODE" className="flex-1 bg-[#050810] border border-white/10 rounded-xl px-4 py-3 text-white font-mono uppercase text-center focus:outline-none focus:border-cyan-500" />
                            <button onClick={handleJoin} className="px-6 py-4 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]">JOIN</button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-[#050810] flex relative overflow-hidden">
            <div className="flex-1 relative">
                <div className="absolute top-8 left-8 z-50 flex gap-2">
                    <button onClick={onBack} className="p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-all border border-white/10 backdrop-blur-md" title="Back to Lobby"><ChevronLeft className="w-6 h-6" /></button>
                    <button onClick={onBack} className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/20 backdrop-blur-md transition-all text-xs uppercase tracking-widest flex items-center gap-2"><LogOut className="w-4 h-4" /> EXIT GAME</button>
                    {!isMobile && (
                        <button
                            onClick={toggleClapPlay}
                            className={`px-4 py-2 rounded-xl font-bold border backdrop-blur-md transition-all text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg ${isClapPlayActive
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/10 animate-pulse'
                                : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/10 hover:text-white'
                                }`}
                        >
                            <Zap className="w-4 h-4" /> {isClapPlayActive ? '🎙️ CLAP ON' : '🎙️ CLAP OFF'}
                        </button>
                    )}
                </div>
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 text-center pointer-events-none">
                    <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-500 mb-1 uppercase tracking-widest drop-shadow-lg">Neural Ludo 3D</h1>
                    <p className="text-emerald-500 font-mono text-xs uppercase tracking-[0.4em] bg-black/50 px-4 py-1 rounded-full backdrop-blur-md mb-1">Room: {gameState?.roomId}</p>
                    {gameState?.betAmount > 0 && <p className="text-amber-400 font-bold text-xs uppercase bg-amber-500/20 px-3 py-0.5 rounded-full backdrop-blur-md inline-block border border-amber-500/30">BET: {gameState.betAmount} LKR</p>}
                </div>

                {/* Wallet Widget */}
                <div className="absolute top-8 right-8 z-50">
                    <button onClick={() => setShowWalletHistory(!showWalletHistory)} className="px-4 py-2 rounded-xl bg-[#0c1222] hover:bg-[#162032] text-amber-400 font-black border border-amber-500/30 backdrop-blur-md transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        💰 {walletInfo?.wallet || 0} LKR
                    </button>
                    {showWalletHistory && (
                        <div className="absolute top-14 right-0 w-80 bg-[#0c1222]/95 backdrop-blur-xl border border-amber-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] mt-2">
                            <div className="flex justify-between items-center mb-6 pb-2 border-b border-white/5">
                                <h3 className="text-amber-400 font-black text-sm uppercase tracking-[0.2em]">Transaction Log</h3>
                                <div className="text-[10px] text-gray-500 font-mono">NEURAL_LEDGER_V3</div>
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-4 pr-2 scrollbar-thin">
                                {walletInfo?.history?.length > 0 ? walletInfo.history.map((h: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                                        <div>
                                            <p className="text-white text-xs font-bold uppercase">{h.reason}</p>
                                            <p className="text-[9px] text-gray-500 font-mono">{new Date(h.date).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-black text-sm ${h.type === 'cash_in' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {h.type === 'cash_in' ? '+' : '-'}{h.amount}
                                            </p>
                                            <p className={`text-[8px] font-black uppercase tracking-widest ${h.type === 'cash_in' ? 'text-emerald-500/50' : 'text-red-500/50'}`}>
                                                {h.type === 'cash_in' ? 'Credit' : 'Debit'}
                                            </p>
                                        </div>
                                    </div>
                                )) : <div className="text-center py-8 text-gray-600 font-mono text-xs italic">No neural transactions found.</div>}
                            </div>
                        </div>
                    )}
                </div>

                {gameState?.state === 'waiting' && (
                    <div className="absolute inset-0 bg-[#050810] flex flex-col items-center justify-center z-40">
                        {/* Top corner control buttons on Lobby screen */}
                        <div className="absolute top-8 left-8 flex gap-2">
                            <button onClick={onBack} className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold border border-red-500/20 backdrop-blur-md transition-all text-xs uppercase tracking-widest flex items-center gap-2"><LogOut className="w-4 h-4" /> EXIT GAME</button>
                            {!isMobile && (
                                <button
                                    onClick={toggleClapPlay}
                                    className={`px-4 py-2 rounded-xl font-bold border backdrop-blur-md transition-all text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg ${isClapPlayActive
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-emerald-500/10 animate-pulse'
                                        : 'bg-white/5 hover:bg-white/10 text-gray-400 border-white/10 hover:text-white'
                                        }`}
                                >
                                    <Zap className="w-4 h-4" /> {isClapPlayActive ? '🎙️ CLAP ON' : '🎙️ CLAP OFF'}
                                </button>
                            )}
                        </div>

                        <h2 className="text-4xl font-black text-white mb-2 tracking-widest text-emerald-400 uppercase">Deploying Grid</h2>
                        <p className="text-gray-400 mb-8 text-sm font-mono tracking-widest">WAITING FOR PLAYERS ({gameState.players?.length || 0}/4)</p>
                        <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-2xl px-6">
                            {gameState.players?.map((p: any, i: number) => {
                                if (loadingSlots.includes(i)) {
                                    return (
                                        <div key={i} className="flex flex-col items-center justify-center gap-2 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/50 animate-pulse">
                                            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                            <div className="text-emerald-400 text-xs font-mono tracking-widest uppercase">Syncing Node...</div>
                                        </div>
                                    );
                                }
                                return (
                                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10" style={{ borderLeft: `6px solid ${COLORS[i]}` }}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center overflow-hidden shrink-0" style={{ borderColor: COLORS[i] }}><img src={String(p.avatar || "").startsWith("data:image") ? p.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${p.avatar || p.name}`} className="w-full h-full object-cover bg-[#050810]" /></div>
                                            <div><h3 className="text-white font-bold">{p.name}</h3><p className="text-xs text-gray-500 font-mono uppercase">{p.isBot ? 'AI Agent' : 'Human'}</p></div>
                                        </div>
                                        {gameState.players[0]?.name === username && i !== 0 && (
                                            <button onClick={() => socket?.emit('ludo_kick', { playerIndex: i })} className="p-2 text-red-500 hover:bg-red-500/20 rounded-xl transition-all" title="Remove Player"><X className="w-5 h-5" /></button>
                                        )}
                                    </div>
                                );
                            })}
                            {[...Array(4 - (gameState.players?.length || 0))].map((_, i) => (
                                <div key={`empty-${i}`} className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 border-dashed opacity-50">
                                    <div className="w-12 h-12 rounded-full border-2 border-gray-600 border-dashed flex items-center justify-center shrink-0"><span className="text-gray-600 text-xs font-mono">P{(gameState.players?.length || 0) + i + 1}</span></div>
                                    <div className="text-gray-600 text-sm font-mono uppercase tracking-widest">Empty Slot</div>
                                </div>
                            ))}
                        </div>
                        {(showStakes || (gameState.betAmount > 0)) && (
                            <div className="mb-8 w-full max-w-2xl px-6 animate-in fade-in slide-in-from-bottom-5 duration-300">
                                <div className="bg-[#0c1222] border border-amber-500/30 rounded-2xl p-6 shadow-[0_0_20px_rgba(245,158,11,0.1)] flex flex-col items-center">
                                    <h3 className="text-amber-400 font-black text-lg uppercase tracking-widest mb-4 flex items-center gap-2"><Zap className="w-5 h-5" /> MATCH STAKES (LKR)</h3>
                                    {gameState.players?.[0]?.name === username ? (
                                        <div className="w-full max-w-md flex flex-col gap-4">
                                            <input
                                                type="range" min="0" max={Math.max(15000, walletInfo.wallet)} step="500"
                                                value={gameState.betAmount || 0}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    if (val > walletInfo.wallet) {
                                                        setEvents(p => [...p, { message: "⚠️ STAKE EXCEEDS YOUR BALANCE!", isError: true }]);
                                                        playSound('capture');
                                                        setTimeout(() => setEvents(p => p.filter(ev => ev.message !== "⚠️ STAKE EXCEEDS YOUR BALANCE!")), 2000);
                                                    }
                                                    socket?.emit('ludo_set_bet', { betAmount: val });
                                                }}
                                                className="w-full accent-amber-500"
                                            />
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500 font-mono text-xs">FREE</span>
                                                <span className="text-amber-400 font-black text-3xl">{gameState.betAmount || 0}</span>
                                                <span className="text-gray-500 font-mono text-xs">{walletInfo.wallet}</span>
                                            </div>
                                            {gameState.betAmount > walletInfo.wallet && (
                                                <div className="text-red-500 text-[10px] font-bold animate-pulse text-center uppercase tracking-widest mt-1">Insufficient Balance</div>
                                            )}
                                            <p className="text-gray-500 text-[10px] font-mono text-center mt-2 uppercase tracking-widest">Adjust slider to set stakes. Others must match this amount.</p>
                                        </div>
                                    ) : (
                                        <div className="text-center">
                                            <p className="text-5xl font-black text-amber-400 mb-2 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">{gameState.betAmount || 0}</p>
                                            <p className="text-gray-500 text-xs font-mono uppercase tracking-widest">Waiting for Host to finalize bet...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Token Skin Selector Section */}
                        <div className="mb-8 w-full max-w-2xl px-6">
                            <div className="bg-[#0c1222]/80 border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                                <h3 className="text-emerald-400 font-black text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                                    ⚙️ SELECT YOUR GEOMETRIC PIECE SKIN
                                </h3>
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                    {[
                                        { id: 'standard', name: 'Standard Unit', icon: '⬢' },
                                        { id: 'button', name: 'Tactical Button', icon: '🔘' },
                                        { id: 'sphere', name: 'Neon Sphere', icon: '●' },
                                        { id: 'cube', name: 'Cyber Cube', icon: '■' },
                                        { id: 'diamond', name: 'Apex Diamond', icon: '💎' },
                                        { id: 'pyramid', name: 'Neural Pyramid', icon: '▲' }
                                    ].map(t => {
                                        const isOwned = inventory.tokens.includes(t.id);
                                        const isSelected = inventory.selectedToken === t.id;
                                        return (
                                            <button
                                                key={t.id}
                                                disabled={!isOwned}
                                                onClick={() => {
                                                    socket?.emit('shop_select', { itemId: t.id, type: 'token' });
                                                }}
                                                className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all relative ${isSelected
                                                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                                    : isOwned
                                                        ? 'bg-white/5 border-white/10 text-white hover:border-white/30'
                                                        : 'bg-black/40 border-white/5 text-gray-600 cursor-not-allowed'
                                                    }`}
                                            >
                                                <span className="text-2xl mb-1">{t.icon}</span>
                                                <span className="text-[9px] font-mono uppercase tracking-tighter truncate w-full text-center">{t.name.split(' ')[1] || t.name}</span>
                                                {!isOwned && (
                                                    <span className="absolute top-1 right-1 text-[8px] opacity-60">🔒</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <button onClick={copyInviteLink} className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl flex items-center gap-2 transition-all"><Copy className="w-5 h-5" /> COPY LINK</button>
                            <button onClick={() => { setShowStakes(true); setShowInviteModal(true); }} className="px-6 py-4 bg-amber-500/20 hover:bg-amber-500/40 text-amber-400 font-bold rounded-xl flex items-center gap-2 transition-all"><Zap className="w-5 h-5" /> BET INVITE</button>
                            <button onClick={() => {
                                setShowStakes(false);
                                socket?.emit('ludo_set_bet', { betAmount: 0 });
                                if (gameState?.betAmount > 0 && gameState?.players?.length >= 2) {
                                    setEvents(p => [...p, { message: "⚠️ Only 2 players allowed in betting matches!", isError: true }]);
                                    setTimeout(() => setEvents(p => p.slice(1)), 3000);
                                    return;
                                }
                                socket?.emit('ludo_add_bot');
                            }} className="px-6 py-4 bg-blue-500/20 hover:bg-blue-500/40 text-blue-400 font-bold rounded-xl flex items-center gap-2 transition-all"><Bot className="w-5 h-5" /> ADD AI (FUN)</button>
                            {gameState.players?.[0]?.name === username && gameState.players?.length >= 2 && <button onClick={handleStart} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-lg rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">START MATCH</button>}
                        </div>
                    </div>
                )}

                <Canvas style={{ background: '#050810' }} shadows camera={{ position: [0, 15, 12], fov: 45 }}>
                    <color attach="background" args={["#050810"]} />
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[10, 20, 10]} castShadow intensity={1} shadow-mapSize={[1024, 1024]} />
                    <Suspense fallback={null}>
                        <Environment preset="city" />
                    </Suspense>
                    <OrbitControls makeDefault maxPolarAngle={Math.PI / 2 - 0.1} minDistance={10} maxDistance={30} />
                    <LudoBoard boardSkin={inventory?.selectedBoard} />
                    {gameState.state === 'playing' && (
                        <>
                            <Dice3D
                                value={gameState.dice}
                                rolling={gameState.diceRolled}
                                onClick={gameState.turn === myPlayerIdx && !gameState.diceRolled ? handleRollDice : undefined}
                                isMyTurn={gameState.turn === myPlayerIdx && !gameState.diceRolled}
                                color={COLORS[gameState.turn]}
                            />
                            {gameState?.pieces?.map((playerPieces: number[], pIdx: number) => (
                                playerPieces.map((pos, pieceIdx) => {
                                    const isMyPiece = pIdx === myPlayerIdx;
                                    const isMyTurn = gameState?.turn === pIdx;
                                    const canMove = isMyTurn && gameState?.diceRolled && (pos === -1 ? (gameState?.dice === 6 || gameState?.dice === 1) : (pos + (gameState?.dice || 0) <= 57));

                                    return (
                                        <Token skin={inventory?.selectedToken}
                                            key={`token-${pIdx}-${pieceIdx}`}
                                            playerIdx={pIdx}
                                            pieceIdx={pieceIdx}
                                            pos={pos}
                                            isMyTurn={isMyTurn}
                                            isMine={isMyPiece}
                                            canMove={canMove}
                                            onClick={() => { if (isMyPiece && isMyTurn && gameState?.diceRolled && canMove) handleMovePiece(pieceIdx); }}
                                        />
                                    );
                                })
                            ))}
                        </>
                    )}
                </Canvas>

                <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col gap-2 items-center">
                    {gameState?.state === 'playing' && gameState?.turn === myPlayerIdx && (
                        <button
                            onClick={!gameState?.diceRolled ? handleRollDice : undefined}
                            className="pointer-events-auto bg-emerald-500/20 backdrop-blur-md px-8 py-3 rounded-2xl border border-emerald-500/50 text-emerald-400 text-sm md:text-lg font-black uppercase tracking-[0.2em] animate-pulse shadow-[0_0_30px_rgba(16,185,129,0.2)] mb-4 cursor-pointer transition-all hover:bg-emerald-500/30"
                        >
                            {gameState?.diceRolled ? "⚡ SELECT A TOKEN TO MOVE ⚡" : "👉 YOUR TURN: TAP TO ROLL 🎲"}
                        </button>
                    )}

                    {/* Real-time Rankings Overlay */}
                    {gameState?.rankings && gameState.rankings.length > 0 && (
                        <div className="absolute top-0 right-0 m-6 flex flex-col gap-2 pointer-events-none">
                            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-1 text-right">Hall of Fame</p>
                            {gameState.rankings.map((pIdx: number, i: number) => (
                                <div key={i} className="flex items-center gap-3 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 animate-slide-in shadow-xl">
                                    <span className="text-amber-400 font-black text-xs">{i + 1}{i === 0 ? 'ST' : i === 1 ? 'ND' : i === 2 ? 'RD' : 'TH'}</span>
                                    <div className="w-8 h-8 rounded-full border-2 overflow-hidden shrink-0" style={{ borderColor: COLORS[pIdx] }}>
                                        <img src={String(gameState.players?.[pIdx]?.avatar || "").startsWith("data:image") ? gameState.players?.[pIdx]?.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${gameState.players?.[pIdx]?.avatar || gameState.players?.[pIdx]?.name}`} className="w-full h-full object-cover bg-[#050810]" />
                                    </div>
                                    <span className="text-white font-bold text-xs truncate max-w-[80px]">{gameState.players?.[pIdx]?.name}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {events.map((ev, i) => <div key={i} className="bg-black/80 backdrop-blur-md px-6 py-2 rounded-full border border-white/10 text-white text-sm font-bold animate-bounce shadow-lg">{ev.message}</div>)}
                </div>

                {showBetSlip && (
                    <div className="absolute inset-0 flex items-center justify-center z-[110] bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                        <div className="bg-[#0c1222] border-2 border-amber-500/50 p-8 rounded-3xl shadow-[0_0_100px_rgba(245,158,11,0.3)] w-80 text-center animate-in zoom-in-95">
                            <div className="flex justify-center mb-6">
                                <div className="relative">
                                    <Zap className="w-12 h-12 text-amber-400 animate-pulse" />
                                    <div className="absolute inset-0 bg-amber-500 blur-2xl opacity-20"></div>
                                </div>
                            </div>
                            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6">Neural Bet Slip</h2>
                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-gray-500 text-xs font-mono uppercase">MY STAKE</span>
                                    <span className="text-emerald-400 font-black">{gameState?.betAmount || 0} LKR</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-gray-500 text-xs font-mono uppercase">AGENT STAKE</span>
                                    <span className="text-amber-400 font-black">{gameState?.betAmount || 0} LKR</span>
                                </div>
                                <div className="flex justify-between items-center pt-2">
                                    <span className="text-white text-sm font-black uppercase">TOTAL POT</span>
                                    <span className="text-white text-xl font-black">{(gameState?.betAmount || 0) * 2} LKR</span>
                                </div>
                            </div>
                            <p className="text-amber-500/50 text-[10px] font-mono animate-pulse">VERIFYING NEURAL HASH...</p>
                        </div>
                    </div>
                )}

                {activeNegotiationChat && (
                    <div className="absolute bottom-6 left-6 w-96 bg-[#0c1222]/95 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] z-[70] flex flex-col animate-in slide-in-from-left duration-500">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                                <h3 className="text-white font-black uppercase tracking-widest text-sm">{activeNegotiationChatName} [NEGOTIATING]</h3>
                            </div>
                            <button onClick={() => setActiveNegotiationChat(null)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X className="w-4 h-4 text-white" /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 mb-6 pr-2 scrollbar-thin scrollbar-thumb-white/10 max-h-96 min-h-[300px] flex flex-col">
                            {privateMessages.map((m, i) => (
                                <div key={i} className={`flex flex-col ${m.isUser ? 'items-end' : 'items-start'}`}>
                                    <span className="text-[10px] text-gray-500 font-mono mb-1 uppercase tracking-widest">{m.senderName}</span>
                                    <div className={`px-4 py-2.5 rounded-2xl text-sm max-w-[85%] break-words ${m.isUser ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30 rounded-tr-none' : 'bg-[#050810] text-gray-300 border border-white/5 rounded-tl-none'}`}>
                                        {m.text}
                                        {readyButtonId === m.id && (
                                            <button
                                                onClick={() => {
                                                    sendPrivateChat("READY", "READY");
                                                    setActiveNegotiationChat(null);
                                                    setReadyButtonId(null);
                                                }}
                                                className="w-full mt-3 py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black rounded-xl transition-all shadow-[0_0_25px_rgba(16,185,129,0.4)] uppercase text-sm tracking-widest flex items-center justify-center gap-2"
                                            >
                                                <Zap className="w-4 h-4" /> READY TO START
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {typingStatus && <div className="text-emerald-500/50 text-[10px] font-mono animate-pulse uppercase tracking-[0.2em]">{typingStatus}</div>}
                            <div ref={chatEndRef} />
                        </div>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!privateChatInput.trim()) return;
                            sendPrivateChat(privateChatInput);
                            setPrivateChatInput("");
                        }} className="relative">
                            <input
                                type="text"
                                value={privateChatInput}
                                onChange={e => setPrivateChatInput(e.target.value)}
                                placeholder="State your offer..."
                                className="w-full bg-[#050810] border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all pr-14"
                            />
                            <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-all shadow-xl"><Send className="w-4 h-4" /></button>
                        </form>
                    </div>
                )}

                {gameState?.state === 'finished' && (
                    <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 backdrop-blur-xl p-6 overflow-y-auto">
                        <div className="text-center mb-6">
                            <h2 className="text-6xl font-black text-amber-400 animate-bounce drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] uppercase tracking-widest">VICTORY</h2>
                            <p className="text-emerald-400 font-mono text-xs uppercase tracking-[0.3em] mt-1">Multiplayer Tiered Prize Distribution</p>
                        </div>

                        <div className="flex flex-col gap-3 mb-8 w-full max-w-lg">
                            {gameState.rankings && gameState.rankings.map((playerIdx: number, i: number) => {
                                const p = gameState.players[playerIdx];
                                if (!p) return null;
                                const totalPlayers = gameState.players.length;
                                const totalPot = (gameState.betAmount || 0) * totalPlayers;

                                let medal = '🏅 PARTICIPANT';
                                let prizeLabel = '0 LKR';
                                let prizeClass = 'text-gray-400';

                                if (i === 0) {
                                    medal = '🥇 1ST PLACE CHAMPION';
                                    const prizeAmt = Math.max(10000, Math.floor(totalPot * 0.60));
                                    prizeLabel = `+${prizeAmt.toLocaleString()} LKR (CREDITED)`;
                                    prizeClass = 'text-amber-400 font-black';
                                } else if (i === 1) {
                                    medal = '🥈 2ND PLACE RUNNER-UP';
                                    const prizeAmt = Math.max(5000, Math.floor(totalPot * 0.25));
                                    prizeLabel = `+${prizeAmt.toLocaleString()} LKR (CREDITED)`;
                                    prizeClass = 'text-emerald-400 font-bold';
                                } else if (i === 2) {
                                    medal = '🥉 3RD PLACE FINISHER';
                                    const prizeAmt = Math.max(2000, Math.floor(totalPot * 0.15));
                                    prizeLabel = `+${prizeAmt.toLocaleString()} LKR (CREDITED)`;
                                    prizeClass = 'text-cyan-400 font-bold';
                                } else {
                                    medal = '❌ 4TH PLACE (DEFEATED)';
                                    prizeLabel = '0 LKR (LOST)';
                                    prizeClass = 'text-red-400 font-semibold';
                                }

                                return (
                                    <div key={i} className={`flex items-center justify-between bg-[#0c1222] p-4 rounded-3xl border shadow-2xl ${i === 0 ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'border-white/10'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-full border-4 flex items-center justify-center overflow-hidden shrink-0" style={{ borderColor: COLORS[playerIdx] }}>
                                                <img src={String(p.avatar || "").startsWith("data:image") ? p.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${p.avatar || p.name}`} className="w-full h-full object-cover bg-[#050810]" />
                                            </div>
                                            <div>
                                                <p className={`font-mono text-xs uppercase tracking-widest mb-1 ${i === 0 ? 'text-amber-400 font-bold' : 'text-emerald-500'}`}>{medal}</p>
                                                <p className="text-xl text-white font-black">{p.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`font-mono text-sm uppercase px-3 py-1.5 rounded-xl bg-black/40 border border-white/5 ${prizeClass}`}>
                                                {prizeLabel}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Show 4th place / unranked if needed */}
                            {gameState.players.map((p: any, pIdx: number) => {
                                if (gameState.rankings && gameState.rankings.includes(pIdx)) return null;
                                return (
                                    <div key={`unranked_${pIdx}`} className="flex items-center justify-between bg-[#0c1222]/60 p-4 rounded-3xl border border-red-500/20">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-full border-4 flex items-center justify-center overflow-hidden shrink-0 opacity-60" style={{ borderColor: COLORS[pIdx] }}>
                                                <img src={String(p.avatar || "").startsWith("data:image") ? p.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${p.avatar || p.name}`} className="w-full h-full object-cover bg-[#050810]" />
                                            </div>
                                            <div>
                                                <p className="font-mono text-xs uppercase tracking-widest mb-1 text-red-400">❌ 4TH PLACE (DEFEATED)</p>
                                                <p className="text-xl text-gray-300 font-bold">{p.name}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-mono text-xs uppercase px-3 py-1.5 rounded-xl bg-black/40 border border-red-500/30 text-red-400 font-bold">
                                                0 LKR (LOST)
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="flex flex-col gap-4 mt-4 w-full max-w-md">
                            <button onClick={handleReset} className="w-full py-5 bg-emerald-500 text-black font-black text-xl rounded-2xl flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all shadow-[0_0_30px_rgba(16,185,129,0.4)]">
                                <RotateCcw className="w-6 h-6" /> REMATCH {gameState.betAmount > 0 ? `(${gameState.betAmount} LKR)` : ''}
                            </button>
                            <div className="flex gap-4 w-full">
                                <button onClick={() => setShowInviteModal(true)} className="flex-1 py-4 bg-blue-500/20 text-blue-400 font-black text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-500/40 transition-all border border-blue-500/30 uppercase tracking-widest"><UserPlus className="w-4 h-4" /> INVITE</button>
                                <button onClick={onBack} className="flex-1 py-4 bg-white/5 text-gray-400 font-black text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-white/10 transition-all border border-white/10 uppercase tracking-widest"><LogOut className="w-4 h-4" /> RETURN HOME</button>
                            </div>
                        </div>
                    </div>
                )}

                {showInviteModal && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[60]">
                        <div className="bg-[#0c1222] border border-white/10 p-6 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-emerald-400 animate-pulse" />
                                    {inviteLoading ? "SEARCHING FOR NODES..." : "INVITE NETWORK USERS"}
                                </h2>
                                <button onClick={() => setShowInviteModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-all"><X className="w-5 h-5" /></button>
                            </div>

                            {inviteLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center py-12">
                                    <div className="relative w-24 h-24 mb-6">
                                        <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
                                        <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Bot className="w-10 h-10 text-emerald-400 animate-pulse" />
                                        </div>
                                    </div>
                                    <p className="text-emerald-500 font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Syncing with neural grid...</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-white/10">
                                    {onlineUsers.filter(u => u.username !== username).length > 0 ? (
                                        onlineUsers.filter(u => u.username !== username).map(user => (
                                            <div id={`invite-row-${user.id}`} key={user.id} className={`flex justify-between items-center p-3 bg-[#050810] rounded-xl border border-white/5 hover:border-emerald-500/30 transition-all group ${user.status === 'offline' ? 'opacity-50 grayscale' : ''}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className="relative">
                                                        <img src={String(user.avatar || "").startsWith("data:image") ? user.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`} className="w-10 h-10 object-cover rounded-full border border-white/10" />
                                                        <div className={`absolute bottom-0 right-0 w-3 h-3 ${user.status === 'online' ? 'bg-emerald-500' : 'bg-gray-500'} border-2 border-[#050810] rounded-full`}></div>
                                                    </div>
                                                    <div>
                                                        <p className="text-white text-sm font-bold">{user.username}</p>
                                                        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">{user.status}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => inviteUser(user.id, user.status)} className={`px-4 py-2 text-xs font-black transition-all border rounded-lg uppercase tracking-widest ${user.status === 'online' ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black border-emerald-500/20 group-hover:border-emerald-500/50' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>INVITE</button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12">
                                            <ShieldAlert className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                                            <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">No active nodes found</p>
                                            <p className="text-gray-600 text-[10px] mt-2">Try inviting agents or external links</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

            <div className={`${isMobile
                ? `fixed inset-y-0 right-0 w-80 bg-[#0c1222]/95 backdrop-blur-2xl z-[60] shadow-2xl transition-transform duration-300 transform flex flex-col ${showMobileSidebar ? 'translate-x-0' : 'translate-x-full'}`
                : 'w-80 bg-[#0c1222] border-l border-white/5 flex flex-col shrink-0 z-30'
                }`}>
                {isMobile && (
                    <div className="p-4 border-b border-white/5 flex justify-end">
                        <button
                            onClick={() => setShowMobileSidebar(false)}
                            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 text-xs uppercase tracking-wider transition-all"
                        >
                            ✕ CLOSE PANEL
                        </button>
                    </div>
                )}
                <div className="p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><UserPlus className="w-5 h-5 text-emerald-500" /> Current Players</h2>
                    <div className="space-y-3">
                        {gameState?.players?.map((p: any, i: number) => (
                            <div key={i} className={`flex items-center gap-3 p-3 rounded-xl transition-all border ${gameState?.turn === i && gameState?.state === 'playing' ? 'bg-white/10 border-white/20 scale-[1.02] shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'bg-[#050810] border-transparent opacity-70'}`}>
                                <div className="w-12 h-12 rounded-full border-2 flex items-center justify-center shrink-0 overflow-hidden" style={{ borderColor: COLORS[i] }}><img src={String(p.avatar || "").startsWith("data:image") ? p.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${p.avatar || p.name}`} className="w-full h-full object-cover bg-[#050810]" /></div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="text-white font-bold text-sm truncate">
                                        {p.name} {p.isBot && <span className="text-xs text-emerald-500 ml-1">(AI)</span>}
                                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: COLORS[i] + '40', color: COLORS[i] }}>
                                            {['RED', 'GREEN', 'YELLOW', 'BLUE'][i]}
                                        </span>
                                    </p>
                                    <div className="flex gap-1 mt-1 justify-between pr-2">
                                        {[0, 1, 2, 3].map((idx) => {
                                            const pos = gameState?.pieces?.[i]?.[idx];
                                            const isHome = pos === 57;
                                            const isOut = pos > -1 && pos < 57;
                                            return <div key={idx} className={`w-3 h-3 rounded-sm border border-black/50`} style={{ backgroundColor: isHome ? COLORS[i] : isOut ? COLORS[i] : '#1a2436', opacity: isHome ? 1 : isOut ? 0.8 : 0.3 }}></div>;
                                        })}
                                    </div>
                                </div>
                                {gameState?.turn === i && gameState?.state === 'playing' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
                            </div>
                        ))}
                    </div>

                    {sentInvites.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-white/5">
                            <h2 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <Zap className="w-3 h-3" /> Pending Connections
                            </h2>
                            <div className="space-y-2">
                                {sentInvites.map((u, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5 opacity-60">
                                        <div className="w-8 h-8 rounded-full bg-[#050810] flex items-center justify-center shrink-0 border border-white/10 overflow-hidden"><img src={String(u.avatar || "").startsWith("data:image") ? u.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${u.username}`} className="w-full h-full object-cover" /></div>
                                        <p className="text-white text-xs font-bold truncate flex-1">{u.username}</p>
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 flex flex-col p-4 overflow-hidden">
                    <h3 className="text-gray-400 text-xs font-mono uppercase tracking-widest mb-4 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Game Chat</h3>
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scrollbar-thin scrollbar-thumb-white/10">
                        {messages.map((m, i) => (
                            <div key={i} className={`flex flex-col ${m.sender === username ? 'items-end' : 'items-start'}`}>
                                <span className="text-[10px] text-gray-500 font-mono mb-1">{m.sender}</span>
                                <div className={`px-4 py-2 rounded-2xl text-sm ${m.sender === 'SYSTEM' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : m.sender === username ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-500/30 rounded-br-sm' : 'bg-white/5 text-gray-300 border border-white/10 rounded-bl-sm'}`}>{m.text}</div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-1 shrink-0 scrollbar-hide">
                        {['🔥', '😂', '🤡', 'GG', 'LUCKY', 'REVENGE', 'CHILL', 'REMATCH'].map((emoji) => (
                            <button key={emoji} type="button" onClick={() => {
                                socket?.emit('ludo_chat', { message: emoji });
                            }} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-400 transition-all shrink-0">{emoji}</button>
                        ))}
                    </div>
                    <form onSubmit={sendChat} className="flex gap-2 shrink-0">
                        <input type="text" value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Send a message..." className="flex-1 bg-[#050810] border border-white/10 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 transition-all" />
                        <button type="submit" className="p-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl transition-all"><Send className="w-4 h-4" /></button>
                    </form>
                </div>
            </div>

            {/* Transaction Popup Overlay */}
            {transactionPopup && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] pointer-events-none animate-in fade-in duration-300">
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="bg-[#050810] border border-white/10 p-8 rounded-3xl flex flex-col items-center justify-center w-80 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <div className={`w-20 h-20 rounded-full border-4 flex items-center justify-center mb-6 animate-pulse ${transactionPopup.type === 'credit' ? 'border-emerald-500 bg-emerald-500/20' : 'border-red-500 bg-red-500/20'}`}>
                            <span className="text-4xl font-black text-white">{transactionPopup.type === 'credit' ? '+' : '-'}</span>
                        </div>
                        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-widest text-center">
                            {transactionPopup.type === 'credit' ? 'FUNDS ADDED' : 'FUNDS DEDUCTED'}
                        </h2>
                        <p className={`text-4xl font-black ${transactionPopup.type === 'credit' ? 'text-emerald-400' : 'text-red-400'} drop-shadow-md mb-2`}>
                            {transactionPopup.amount} LKR
                        </p>
                        <p className="text-xs font-mono text-gray-500 text-center uppercase">
                            {transactionPopup.message}
                        </p>
                    </motion.div>
                </div>
            )}
            {isMobile && !showMobileSidebar && (
                <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="fixed bottom-24 right-6 z-[45] px-5 py-4 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-black shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2 text-xs uppercase tracking-widest transition-all"
                >
                    <MessageSquare className="w-4 h-4" /> CHAT & NODES
                </button>
            )}

            {isMobile && showMobileSidebar && (
                <div
                    onClick={() => setShowMobileSidebar(false)}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] animate-in fade-in duration-300"
                />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
      `}} />
        </div>
    );
}
