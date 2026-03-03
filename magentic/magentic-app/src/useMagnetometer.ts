import { useRef, useState, useCallback, useEffect } from 'react';
import { Magnetometer } from 'expo-sensors';
import { Sample } from './types';

interface UseMagnetometerReturn {
    isRecording: boolean;
    sampleCount: number;
    lastMagnitude: number | null;
    samples: Sample[];
    startRecording: (hz?: number) => void;
    stopRecording: () => void;
    clearSamples: () => void;
}

export function useMagnetometer(): UseMagnetometerReturn {
    const [isRecording, setIsRecording] = useState(false);
    const [sampleCount, setSampleCount] = useState(0);
    const [lastMagnitude, setLastMagnitude] = useState<number | null>(null);

    const samplesRef = useRef<Sample[]>([]);
    const subscriptionRef = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
    const countRef = useRef(0);

    const startRecording = useCallback((hz: number = 50) => {
        // Clear previous
        samplesRef.current = [];
        countRef.current = 0;
        setSampleCount(0);
        setLastMagnitude(null);

        const intervalMs = Math.round(1000 / hz);
        Magnetometer.setUpdateInterval(intervalMs);

        subscriptionRef.current = Magnetometer.addListener((data) => {
            const { x, y, z } = data;
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            const sample: Sample = {
                timestamp: Date.now(),
                x,
                y,
                z,
                magnitude,
            };

            samplesRef.current.push(sample);
            countRef.current += 1;

            // Update UI state every 5 samples to avoid excessive re-renders
            if (countRef.current % 5 === 0 || countRef.current === 1) {
                setSampleCount(countRef.current);
                setLastMagnitude(magnitude);
            }
        });

        setIsRecording(true);
    }, []);

    const stopRecording = useCallback(() => {
        if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
        }
        setIsRecording(false);
        // Final sync of count
        setSampleCount(countRef.current);
        if (samplesRef.current.length > 0) {
            setLastMagnitude(
                samplesRef.current[samplesRef.current.length - 1].magnitude
            );
        }
    }, []);

    const clearSamples = useCallback(() => {
        samplesRef.current = [];
        countRef.current = 0;
        setSampleCount(0);
        setLastMagnitude(null);
    }, []);

    // Clean up on unmount
    useEffect(() => {
        return () => {
            if (subscriptionRef.current) {
                subscriptionRef.current.remove();
            }
        };
    }, []);

    return {
        isRecording,
        sampleCount,
        lastMagnitude,
        samples: samplesRef.current,
        startRecording,
        stopRecording,
        clearSamples,
    };
}
