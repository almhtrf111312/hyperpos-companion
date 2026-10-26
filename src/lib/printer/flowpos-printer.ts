import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface PrinterDevice {
  name: string;
  address: string;
  paired: boolean;
}

export interface PrinterState {
  supported: boolean;
  enabled: boolean;
  hasPermissions: boolean;
  hasLocation: boolean;
  needsLocation: boolean;
}

export interface FlowPosPrinterPlugin {
  getState(): Promise<PrinterState>;
  requestPermissions(): Promise<{ hasPermissions: boolean; hasLocation: boolean }>;
  enableBluetooth(): Promise<{ enabled: boolean }>;
  listPaired(): Promise<{ devices: PrinterDevice[] }>;
  discover(options?: { durationMs?: number }): Promise<{ devices: PrinterDevice[] }>;
  stopDiscovery(): Promise<void>;
  pair(options: { address: string; pin?: string }): Promise<{ paired: boolean }>;
  connect(options: { address: string }): Promise<{ connected: boolean }>;
  isConnected(): Promise<{ connected: boolean; address: string | null }>;
  print(options: { address: string; data: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(
    eventName: 'deviceFound',
    listener: (device: PrinterDevice) => void
  ): Promise<PluginListenerHandle>;
}

export const FlowPosPrinter = registerPlugin<FlowPosPrinterPlugin>('FlowPosPrinter');

export const isNativeAndroid = (): boolean => Capacitor.getPlatform() === 'android';
