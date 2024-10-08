

//const ByteStream = require("../Core/bytestream");

import ByteIStream from "../Core/byteistream"
import ByteOStream from "../Core/byteostream"

const LOG256 = Math.log(256);
const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();


interface DynamicObject { [key: string]: any };
type ArgMap<T> = { [key in keyof T]: ArgLike<T[key]> };
export type ArgLike<T> = Arg<T> | ArgMap<T>;

//type Unarg<> = T;
//type FlattenArg<T extends ArgLike> = T extends Arg<infer ArgT> ? ArgT : T;



//type ArgLike<T> = (T extends Arg<infer ArgT> ? ArgT : T);



/*type FlattenArgLike<T extends ArgLike> = (
	T extends Arg<infer ArgT> ? ArgT : (
	T extends ArgMap<infer ArgMapT> ? ArgMapT : never
)*/
//type ArgLike<T> = ArgMap<T> | Arg<T>;

//type ArgTuple<T> = Array<ArgLike>;
//type ArgMap = { [key: string]: ArgLike }
//type ArgValue<T extends ArgLike> = T extends Arg;

//type ArgMap = Record<string, ArgLike>


//type ArgValue<Arg<T>> = 

//type ArgValue

//type ArgLike<T> = ArgMap<T>

//type ArgMap<T extends DynamicObject> = { [key: string]: string }

//[ Arg.STR1, Arg.INT1 ] => [string, number]

//import { joinByteArrays, ByteOStream, ByteIStream } from "../Core/byteistream"



class ArgLength {
	
	public readonly iterations: number;
	public readonly bytes: number;
	
	static ZERO = new ArgLength(0, 0);
	static VAR1 = new ArgLength(1, 1);
	static VAR2 = new ArgLength(1, 2);
	static VAR3 = new ArgLength(1, 3);
	
	static fixed(bytes: number) {
		return new ArgLength(0, bytes);
	}
	
	constructor(iterations: number, bytes: number) {
		this.iterations = iterations;
		this.bytes = bytes;
	}
	
}

export default class Arg<T> {
	
	protected length: ArgLength;
	
	constructor(length: ArgLength) {
		this.length = length;
	}
	
	public matches(value: any): boolean {
		console.error("Override Arg.matches");
		return false;
	}
	
	public encode(value: T): Uint8Array {
		console.error("Override Arg.encode");
		return new Uint8Array();
	}
	public streamEncode(value: T, stream: ByteOStream): void {
		stream.write(this.encode(value));
	}
	
	public decode(bytes: Iterable<number>): T {
		throw new Error("Override Arg.decode (unless only using Arg.streamDecode)");
		//return undefined as T; // This is a hack, but probably a necessary one?
	}
	public streamDecode(stream: ByteIStream): T {
		
		let byteCount = Arg.resolveHeader(stream, this.length);
		let bytes = stream.next(byteCount);
		return this.decode(bytes);
		
	}
	
	
	//static safe: boolean = true;
	
	static calculateByteCount(choiceCount: number): number {
		//return Math.max(1, );
		return Math.ceil(Math.log(choiceCount) / LOG256);
	}
	static calculateChoiceCount(byteCount: number): number {
		return 1 << (8 * byteCount);
	}
	static joinByteArrays(...byteArrays: Array<Uint8Array>): Uint8Array {
		return ByteOStream.join(...byteArrays);
	}
	
	static encodeInt(value: number, byteCount?: number): Uint8Array {
		
		byteCount = ( byteCount !== undefined ? byteCount : Arg.calculateByteCount(value) );
		let out = new Uint8Array(byteCount);
		
		for (let i = 0; i < byteCount; i++) {
			out[i] = (value & 255);
			value = value >> 8;
		}
		
		return out;
		
	}
	/*static decodeInt(bytes: Uint8Array): number {
		
		let out = 0;
		
		for (let i = 0; i < bytes.length; i++) {
			out += (bytes[i] << i * 8);
		}
		
		return out;
		
	}*/
	static decodeInt(bytes: Iterable<number>): number {
		
		let out = 0;
		let i = 0;
		
		for (const byte of bytes) {
			
			if (i >= 4)
				continue;
			
			out += byte << (8 * (i++));
			
		}
		
		return out;
		
	}
	static encodeFloat(value: number, min: number, precision: number, byteCount?: number): Uint8Array {
		return this.encodeInt(Math.round((value - min)/precision), byteCount);
	}
	static decodeFloat(bytes: Iterable<number>, min: number, precision: number): number {
		return min + this.decodeInt(bytes) * precision;
	}
	static encodeStr(str: string): Uint8Array {
		return TEXT_ENCODER.encode(str);
	}
	static decodeStr(bytes: Iterable<number>): string {
		return TEXT_DECODER.decode(Uint8Array.from(bytes));
	}
	/*static decodeStrArray(bytes: Uint8Array): string {
		return TEXT_DECODER.decode(bytes);
	}*/
	
	static createHeader(footprint: ArgLength, byteCount: number): Uint8Array {
		
		if (footprint.iterations <= 0)
			return new Uint8Array();
		
		let segments = new Array<Uint8Array>;
		
		for (let i = 0; i < footprint.iterations; i++) {
			
			let lengthToEncode = (i == 0 ? byteCount : segments[0].length);
			let newSegmentLength = Arg.calculateByteCount(lengthToEncode);
			
			if (i === footprint.iterations - 1) { // last iteration
				
				if (footprint.bytes < newSegmentLength)
					throw "Length header too small to encode value";
				
				newSegmentLength = footprint.bytes;
				
			}
			
			segments.unshift(this.encodeInt(lengthToEncode, newSegmentLength));
			
		}
		
		return Arg.joinByteArrays(...segments);
		
	}
	static withHeader(footprint : ArgLength, bytes: Uint8Array): Uint8Array {
		return Arg.joinByteArrays(
			this.createHeader(footprint, bytes.length),
			bytes
		);
	}
	static resolveHeader(stream: ByteIStream, footprint: ArgLength): number {
		
		let byteCount: number = footprint.bytes;
		
		for(let i = 0; i < footprint.iterations; i++) {
			byteCount = this.decodeInt(stream.next(byteCount));
		}
		
		return byteCount;
		
	}
	
	static matches(arg: ArgLike<any>, value: any): boolean {
		
		if (arg == null) {
			return value == null;
		}
		else if (arg instanceof Arg) {
			return arg.matches(value);
		}
		else if (Array.isArray(arg)) {
			
			if (!Array.isArray(value) || arg.length !== value.length)
				return false;
			
			
			for (let i = 0; i < arg.length; i++) {
				if (!this.matches(arg[i], value[i]))
					return false;
			}
			
			return true;
			
		}
		else {
			
			for (const key in arg) {
				if (!this.matches(arg[key], (key in value) ? value[key] : null))
					return false;
			}
			
			return true;
			
		}
		
	}
	static matchesAll(arg: ArgLike<any>, values: Iterable<any>): boolean {
		
		for (const value of values) {
			
			if (!Arg.matches(arg, value))
				return false;
			
		}
		
		return true;
		
	}
	static streamEncodeAll<T>(arg: ArgLike<T>, values: Iterable<T>, stream: ByteOStream): void {
		
		for (const value of values)
			Arg.streamEncode(arg, value, stream);
		
	}
	
	
	static streamDecodeAll(arg: any, count: number, stream: ByteIStream): Array<any> {
		
		let out = new Array<any>();
		
		for (let i = 0; i < count; i++) {
			out.push(Arg.streamDecode(arg, stream));
		}
		
		return out;
		
	}
	
	static encode(arg : any, value : any): Uint8Array {
		
		if (!this.matches(arg, value))
			console.error("Arg/Value Mismatch | ", value, " | ", arg);
		
		let stream = new ByteOStream();
		this.streamEncode(arg, value, stream);
		return stream.bytes;
		
	}
	static streamEncode(arg: any, value: any, stream: ByteOStream): void {
		
		if (arg == null) {
			
			if (value != null)
				console.error("Invalid null arg footprint.");
			
		}
		else if (arg instanceof Arg) {
			arg.streamEncode(value, stream);
		}
		else if (Array.isArray(arg)) {
			
			for (let i = 0; i < arg.length; i++)
				this.streamEncode(arg[i], value[i], stream);
			
		}
		else {
			
			for (const key in arg) {
				this.streamEncode(arg[key], value[key], stream);
			}
			
		} // TODO: improve error handling
		
	}
	
	static decode(arg: any, bytes: Uint8Array): any {
		return this.streamDecode(arg, new ByteIStream(bytes));
	}
	static streamDecodeSafe<T>(arg: ArgLike<T>, stream: ByteIStream): T {
		
		let decoded = this.streamDecode<T>(arg, stream);
		stream.verifyExactComplete();
		return decoded;
		
	}
	static streamDecode<T>(arg: ArgLike<T>, stream: ByteIStream): T {
		
		/*if (arg === undefined) {
			return undefined;
		}*/
		if (arg instanceof Arg) {
			return arg.streamDecode(stream);
		}
		
		else {
			
			//let decoded = {} as T;
			
			if (Array.isArray(arg)) {
				
				let decoded = [];
				
				for (const subarg of arg)
					decoded.push(this.streamDecode(subarg, stream));
				
				return decoded as T;
				
			}
			
			else {
				
				let decoded = {} as DynamicObject;
				
				for (const key in arg)
					decoded[key] = this.streamDecode(arg[key], stream);
				
				return decoded as T;
				
			}
			
		}
		
		/*else if (arg instanceof Array) {
			
			let decoded = new Array<any>();
			
			for (const subarg of arg)
				decoded.push(this.streamDecode(subarg, stream));
			
			return decoded;
			
		}
		else {
			
			let decoded: DynamicObject = {};
			
			for (const key in arg)
				decoded[key] = this.streamDecode(arg[key], stream);
			
			return decoded;
			
		}*/
		
	}
	
	static test(arg: any, value: any): void {
		
		let encoded = Arg.encode(arg, value);
		let decoded = Arg.decode(arg, encoded);
		
		//if (decoded !== encoded)
		//	console.log("Arg test failed!");
		
		console.log(value);
		console.log(decoded);
		console.log(encoded);
		
	}
	
	static rawFixed(byteCount: number): RawArg {
		return RawArg.fixed(byteCount);
	}
	static strFixed(byteCount: number): StrArg {
		return StrArg.fixed(byteCount);
	}
	
	/*static int(byteCount: number, min: number): IntArg {
		return new IntArg(byteCount, min);
	}*/
	static float(min: number, max: number, precision: number = 0.01): FloatArg {
		return new FloatArg(min, max, precision);
	}
	/*static str(iterCount: number = 1, byteCount: number = 2): StrArg {
		return new StrArg(iterCount, byteCount);
	}*/
	static choice<T>(...choices: Array<T>): ChoiceArg<T> {
		return new ChoiceArg<T>(...choices);
	}
	static array<T>(arg: ArgLike<T>): ArrayArg<T> {
		return Arg.arrayLong<T>(arg);
	}
	static arrayShort<T>(arg: ArgLike<T>): ArrayArg<T> {
		return new ArrayArg<T>(arg, ArgLength.VAR1);
	}
	static arrayLong<T>(arg: ArgLike<T>): ArrayArg<T> {
		return new ArrayArg<T>(arg, ArgLength.VAR2);
	}
	static map<KeyT extends keyof any, ValueT>(keyArg: ArgLike<KeyT>, valueArg: ArgLike<ValueT>): MapArg<KeyT, ValueT> {
		return Arg.mapLong(keyArg, valueArg);
	}
	static mapShort<KeyT extends keyof any, ValueT>(keyArg: ArgLike<KeyT>, valueArg: ArgLike<ValueT>): MapArg<KeyT, ValueT> {
		return new MapArg(keyArg, valueArg, ArgLength.VAR1);
	}
	static mapLong<KeyT extends keyof any, ValueT>(keyArg: ArgLike<KeyT>, valueArg: ArgLike<ValueT>): MapArg<KeyT, ValueT> {
		return new MapArg(keyArg, valueArg, ArgLength.VAR2);
	}
	
	
	static branch<T>(...paths : Array<ArgLike<T>>): BranchArg<T> {
		return new BranchArg(paths);
	}
	static const<T>(value: T): ConstArg<T> {
		return new ConstArg(value, true);
	}
	static auto<T>(value: T): ConstArg<T> {
		return new ConstArg(value, false);
	}
	static default<T, FallbackT>(arg: ArgLike<T>, fallback: FallbackT): BranchArg<T | FallbackT> {
		return new BranchArg([ new ConstArg(fallback, false), arg ]);
	}
	static optional<T>(arg: ArgLike<T>): BranchArg<T | undefined> {
		return Arg.default(arg, undefined);
	}
	
	/*static UINT1 = this.int(1, 0);
	static UINT2 = this.int(2, 0);
	static UINT4 = this.int(4, 0);
	static UINT6 = this.int(6, 0);
	
	static INT1 = this.int(1, -128);
	static INT2 = this.int(2, -32768);
	static INT4 = this.int(4, -2147483648);
	static INT6 = this.int(6, -281474976710656);
	
	static CHAR = this.str(0, 1);
	static STRING1 = this.str(1, 1);
	static STRING2 = this.str(2, 1);
	
	static BOOL = this.choice(false, true);*/
	
	static RAW1: RawArg;
	static RAW2: RawArg;
	static RAW3: RawArg;
	
	static UINT1: IntArg;
	static UINT2: IntArg;
	static UINT4: IntArg;
	static UINT6: IntArg;
	
	static INT1: IntArg;
	static INT2: IntArg;
	static INT4: IntArg;
	static INT6: IntArg;
	
	static CHAR: StrArg;
	static STR1: StrArg;
	static STR2: StrArg;
	static STR3: StrArg;
	
	static BOOL: ChoiceArg<boolean>;
	
	static NONE: ConstArg<undefined>;
	
}


class RawArg extends Arg<Uint8Array> {
	
	static fixed(bytes: number) {
		return new RawArg(ArgLength.fixed(bytes));
	}
	
	constructor(length: ArgLength) {
		super(length);
	}
	
	public matches(value: any): boolean { // Maybe wants a length check
		return value instanceof Uint8Array;
	}
	public streamEncode(value: Uint8Array, stream: ByteOStream): void {
		stream.write(Arg.createHeader(this.length, value.length));
		stream.write(value);
	}
	public streamDecode(stream: ByteIStream): Uint8Array {
		
		let byteCount = Arg.resolveHeader(stream, this.length);
		return stream.nextArray(byteCount);
		
	}
	/*public streamDecode(stream: ByteIStream): Uint8Array {
		return 
	}*/
	
}
class ChoiceArg<T> extends Arg<T> {
	
	private choices: Array<T>;
	
	constructor(...choices: Array<T>) {
		super(ArgLength.fixed(Arg.calculateByteCount(choices.length)));
		this.choices = choices;
	}
	
	matches(value: any): boolean {
		return this.choices.includes(value);
	}
	encode(value: T): Uint8Array {
		
		let index = this.choices.indexOf(value);
		
		if (index < 0)
			console.error("Invalid ChoiceArg choice: ", value, " | ", this.choices);
		
		return Arg.encodeInt(index, this.length.bytes);
	}
	decode(bytes: Iterable<number>): T {
		return this.choices[Arg.decodeInt(bytes)];
	}
	
}
class IntArg extends Arg<number> {
	
	private min: number;
	private max: number; // not inclusive
	
	constructor(byteCount: number, min = 0) {
		
		super(ArgLength.fixed(byteCount));
		
		this.min = min;
		this.max = min + Arg.calculateChoiceCount(byteCount);
		
	}
	
	public matches(value: any): boolean {
		
		if (typeof value != "number")
			return false;
		
		return Number.isInteger(value) && value >= this.min && value < this.max;
		
	}
	public encode(value: number): Uint8Array {
		return Arg.encodeInt(value - this.min, this.length.bytes);
	}
	public decode(bytes: Iterable<number>) {
		return Arg.decodeInt(bytes) + this.min;
	}
	
}
class FloatArg extends Arg<number> {
	
	private min: number;
	private max: number; // exclusive
	private precision: number;
	
	constructor(min: number, max: number, precision: number) {
		
		if (precision === undefined) precision = 0.01;
		super(ArgLength.fixed(Arg.calculateByteCount((max - min)/precision)));
		
		this.min = (min === undefined ? 0 : min);
		this.max = this.min + precision * Arg.calculateChoiceCount(this.length.bytes);
		this.precision = precision;
	}
	
	public matches(value: any): boolean {
		
		if (typeof value != "number")
			return false;
		
		return value >= this.min && value < this.max;
		
	}
	public encode(value: number): Uint8Array {
		return Arg.encodeFloat(value, this.min, this.precision, this.length.bytes);
	}
	public decode(bytes: Iterable<number>): number {
		return Arg.decodeFloat(bytes, this.min, this.precision);
	}
	
}
class StrArg extends Arg<string> {
	
	static fixed(bytes: number): StrArg {
		return new StrArg(ArgLength.fixed(bytes));
	}
	
	constructor(length: ArgLength) {
		super(length);
	}
	
	public matches(value: any) {
		
		if (typeof value != "string")
			return false;
		
		return true; // TODO: should probably length check
		
	}
	public encode(value: string): Uint8Array {
		return Arg.withHeader(this.length, Arg.encodeStr(value));
	}
	public decode(bytes: Iterable<number>): string {
		return Arg.decodeStr(bytes);
	}
	
}
class ArrayArg<T> extends Arg<Array<T>> {
	
	private arg: any;
	
	constructor(arg: any, length = ArgLength.VAR2) {
		
		// special length header that tells how many copies of the sublist you get
		// also, this is certified black magic
		super(length);
		this.arg = arg;
		
	}
	
	public matches(values: any): boolean {
		
		if (!Array.isArray(values) && !(values instanceof Set))
			return false;
		
		return Arg.matchesAll(this.arg, values);
		
	}
	/*public encode(values: Array<any>): Uint8Array {
		
		return Arg.joinByteArrays(
			Arg.createHeader(this.length, values.length), // header
			...(values.map(value => { return Arg.encode(this.arg, value) })) // encoded values
		);
		
		//return Arg.joinByteArrays([ header, encoded ]);
		
	}*/
	public streamEncode(values : Array<T>, stream : ByteOStream): void {
		
		stream.write(Arg.createHeader(this.length, values.length));
		Arg.streamEncodeAll(this.arg, values, stream);
		
	}
	public streamDecode(stream: ByteIStream): Array<T> {
		
		return Arg.streamDecodeAll(
			this.arg,
			Arg.resolveHeader(stream, this.length),
			stream
		);
		/*let decoded = new Array<any>();
		
		for (let i = 0; i < valueCount; i++) {
			decoded.push(Arg.streamDecode(this.arg, stream));
		}
		
		
		return decoded;*/
		
	}
	
}
class MapArg<Key, Value> extends Arg<Map<Key, Value>> {
	
	private keyArg: ArgLike<Key>;
	private valueArg: ArgLike<Value>;
	
	//fixed() {
	//	
	//}
	
	constructor(keyArg: ArgLike<Key>, valueArg: ArgLike<Value>, length = ArgLength.VAR2) {
		
		super(length);
		
		this.keyArg = keyArg;
		this.valueArg = valueArg;
		
	}
	
	public matches(obj: any): boolean {
		
		if (obj instanceof Map)
			return Arg.matchesAll(this.keyArg, obj.keys()) && Arg.matchesAll(this.valueArg, obj.values());
		//else if (typeof obj == "object" && Object.getPrototypeOf(obj) === Object.prototype)
		//	return Arg.matchesAll(this.keyArg, Object.keys(obj)) && Arg.matchesAll(this.valueArg, Object.values(obj));
		else
			return false;
		
	}
	
	public streamEncode(map: Map<Key, Value>, stream: ByteOStream): void {
		
		stream.write(Arg.createHeader(this.length, map.size));
		
		for (const [key, value] of map.entries()) {
			Arg.streamEncode(this.keyArg, key, stream);
			Arg.streamEncode(this.valueArg, value, stream);
		}
		
		/*if (obj instanceof Map) {
			
			stream.write(Arg.createHeader(this.length, obj.size));
			
			for (const [key, value] of obj) {
				Arg.streamEncode(this.keyArg, key, stream);
				Arg.streamEncode(this.valueArg, value, stream);
			}
			
		}
		else { // Generic object, probably a literal
			
			let keys = Object.keys(obj);
			
			stream.write(Arg.createHeader(this.length, keys.length));
			
			for (const key of keys) {
				Arg.streamEncode(this.keyArg, key, stream);
				Arg.streamEncode(this.valueArg, obj[key], stream);
			}
			
		}*/
		
	}
	public streamDecode(stream: ByteIStream): Map<Key, Value> {
		
		let valueCount = Arg.resolveHeader(stream, this.length);
		let decoded = new Map<Key, Value>();
		
		for (let i = 0; i < valueCount; i++) {
			
			decoded.set(
				Arg.streamDecode(this.keyArg, stream),
				Arg.streamDecode(this.valueArg, stream)
			);
			
		}
		
		return decoded;
		
	}
	
}


class BranchArg<T> extends Arg<T> {
	
	private paths : Array<any>;
	
	constructor(paths : Iterable<any>, length = ArgLength.VAR1) {
		super(length);
		this.paths = Array.from(paths);
	}
	
	public matches(value: any): boolean {
		
		for (const path of this.paths)
			if (Arg.matches(path, value))
				return true;
		
		return false;
		
	}
	public streamEncode(value : T, stream : ByteOStream): void {
		
		for (let i = 0; i < this.paths.length; i++) {
			//console.log(i)
			if (Arg.matches(this.paths[i], value)) { // Use first matching path
				
				stream.write(Arg.encodeInt(i, this.length.bytes));
				Arg.streamEncode(this.paths[i], value, stream);
				return;
			}
			
		}
		
		console.error("No match found for BranchArg.");
		
	}
	public streamDecode(stream : ByteIStream): T {
		
		let path = Arg.resolveHeader(stream, this.length);
		
		return Arg.streamDecode( // Header tells us which path to use
			this.paths[path],
			stream
		);
		
	}
	
}
class ConstArg<T> extends Arg<T> {
	
	private value: T;
	private mandatory: boolean;
	
	constructor(value: T, mandatory = true) {
		
		super(ArgLength.ZERO);
		
		this.value = value;
		this.mandatory = mandatory;
		
	}
	
	public matches(value: any): boolean {
		
		if (value === this.value)
			return true;
		else if (value == undefined)
			return !this.mandatory;
		else
			return false;
		
	}
	
	public streamEncode(value: T | undefined, stream: ByteOStream): void {
		
		if (value === undefined) {
			if (this.mandatory) {
				console.error("Invalid value for mandatory constArg");
			}
		}
		else if (value !== this.value) {
			throw new Error("Invalid value for ConstArg.");
		}
		
	}
	public streamDecode(stream: ByteIStream): T {
		return this.value;
	}
	
	
}

Arg.RAW1 = new RawArg(ArgLength.VAR1);
Arg.RAW2 = new RawArg(ArgLength.VAR2);
Arg.RAW3 = new RawArg(ArgLength.VAR3);

Arg.UINT1 = new IntArg(1, 0);
Arg.UINT2 = new IntArg(2, 0);
Arg.UINT4 = new IntArg(4, 0);
Arg.UINT6 = new IntArg(6, 0);

Arg.INT1 = new IntArg(1, -128);
Arg.INT2 = new IntArg(2, -32768);
Arg.INT4 = new IntArg(4, -2147483648);
Arg.INT6 = new IntArg(6, -281474976710656);

Arg.CHAR = StrArg.fixed(1);
Arg.STR1 = new StrArg(ArgLength.VAR1);
Arg.STR2 = new StrArg(ArgLength.VAR2);
Arg.STR3 = new StrArg(ArgLength.VAR3);

Arg.BOOL = Arg.choice<boolean>(false, true);

Arg.NONE = Arg.auto(undefined);


/*let arg = {
	peerID: Arg.UINT2,
	//media: Arg.STRING1,
	//index: Arg.UINT2,
	//name: Arg.STRING2
	candidate: Arg.STRING2,
	sdpMLineIndex: Arg.INT2,
	sdpMid: Arg.STRING2,
	usernameFragment: Arg.STRING2
};*/


/*let encoded = Arg.encode(arg, {
	peerID: 2,
	candidate: "candidate",
	sdpMLineIndex: 12,
	sdpMid: "yeah",
	usernameFragment: "yeah"
})*/

//let encoded = Arg.encode(arg, { peerID: 0, candidate: "candidate:0 1 UDP 2122252543 ebde5967-d563-4beb-bada-3bc12fa08c35.local 62385 typ host", sdpMid: "0", sdpMLineIndex: 0, usernameFragment: "65db9032" });

/*let arg = Arg.STRING2;

let encoded = new Uint8Array([ 7, 0, 0, 0, 0, 0, 1, 0, 48, 0, 128, 8, 0, 99, 51, 52, 51, 50, 55, 98, 52 ]);


console.log(Arg.decode({
	peerID: Arg.UINT2,
	//media: Arg.STRING1,
	//index: Arg.UINT2,
	//name: Arg.STRING2
	candidate: Arg.STRING2,
	sdpMid: Arg.STRING2,
	sdpMLineIndex: Arg.UINT2,
	usernameFragment: Arg.STRING2
}, encoded))

Arg.test({
	peerID: Arg.UINT2,
	//media: Arg.STRING1,
	//index: Arg.UINT2,
	//name: Arg.STRING2
	candidate: Arg.STRING2,
	sdpMid: Arg.STRING2,
	sdpMLineIndex: Arg.UINT2,
	usernameFragment: Arg.STRING2
}, { peerID: 0, candidate: "candidate:0 1 UDP 2122252543 ebde5967-d563-4beb-bada-3bc12fa08c35.local 62385 typ host", sdpMid: "0", sdpMLineIndex: 0, usernameFragment: "65db9032" });
//console.log(encoded, Arg.decode(arg, encoded))*/

//console.log(Arg.decode(Arg.INT1, Arg.encode(Arg.INT1, 120)));



//console.log(Arg.encode(arg, 1));


/*let testMap = new Map();
testMap.set(0, 3);
testMap.set(4, 6);
testMap.set(7, 0);

Arg.test(Arg.map(Arg.INT1, Arg.INT1), testMap);*/



/*Arg.test(Arg.RAW1, new Uint8Array([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]));
Arg.test(Arg.RAW2, new Uint8Array([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]));
Arg.test(Arg.RAW3, new Uint8Array([1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]));
Arg.test(Arg.rawFixed(5), new Uint8Array([4, 5, 7, 10, 12]));*/







/*let arg = Arg.UINT1;
let argList = [ arg, Arg.array([ arg, arg ]), { a: [ arg, arg ], b: arg } ];


let encoded = Arg.encode(argList, [0, [[1, 2], [3, 4], [5, 7]], { a: [ 55, 77 ], b: 66 }]);

console.log(encoded);

let decoded = Arg.decode(argList, encoded);

console.log(decoded);*/

/*let arg = Arg.branch(
	Arg.array(Arg.UINT1),
	Arg.array(Arg.STRING2),
	Arg.array(Arg.array(Arg.CHAR)),
	{ x: Arg.UINT1, y: Arg.UINT1 },
	[ Arg.UINT2, Arg.UINT2 ],
	null
);

//console.log(Arg.encode(arg, [ 1, 2 ]));

let encoded = Arg.encode(arg, { x: 2, y: 10 });
//let encoded = Arg.encode(arg, null);
//let encoded = Arg.encode(arg, [ 1, 2, 255, 33, 85 ]);
//let encoded = Arg.encode(arg, [ ["a", "b"], ["c"] ]);
//let encoded = Arg.encode(arg, [ "w", "heeee" ]);

console.log(encoded);
console.log(Arg.decode(arg, encoded));*/

//console.log(Arg.encodeInt(0));





//type ArgTuple<T extends []> = [ArgLike<T[0]>];
//type ArgTuple<T> = { [key in keyof T]: ArgLike<T[key]> }
//type FlattenArg<T extends Arg<any>> = T extends Arg<infer ArgT> ? ArgT : never;
//type FlattenArgMap<T extends ArgMap<any>> = T extends ArgMap<infer ArgT> ? ArgT : never;
/*type FlattenArgLike<T extends ArgLike<T>> = (
	T extends Arg<infer ArgT> ? ArgT :
	(T extends ArgMap<infer ArgMapT> ? ArgMapT : undefined)
);*/

/*let a: ArgMap<{ name: string }> = { name: Arg.STR1 };
let b: FlattenArgLike<ArgMap<{ name: string }>>;

let c: ArgMap<[number, string]> = [Arg.INT1, Arg.STR2];
let d: FlattenArgLike<typeof c>;*/

