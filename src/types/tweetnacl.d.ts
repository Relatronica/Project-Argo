/**
 * Type definitions for tweetnacl
 * Since @types/tweetnacl doesn't exist, we define minimal types here
 */

declare module 'tweetnacl' {
	export function randomBytes(n: number): Uint8Array;
	export function secretbox(msg: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array | null;
	export function secretbox.open(
		box: Uint8Array,
		nonce: Uint8Array,
		key: Uint8Array
	): Uint8Array | null;
	export function hash(msg: Uint8Array): Uint8Array;
}

declare module 'tweetnacl-util' {
	export function encodeBase64(arr: Uint8Array): string;
	export function decodeBase64(s: string): Uint8Array;
	export function encodeUTF8(arr: Uint8Array): string;
	export function decodeUTF8(s: string): Uint8Array;
}

