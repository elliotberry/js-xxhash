/**
xxHash implementation in pure Javascript

Copyright (C) 2013, Pierre Curto
MIT license
*/
import { UINT32 as UINT32 } from "cuint";

/*
	Merged this sequence of method calls as it speeds up
	the calculations by a factor of 2
 */
// this.v1.add( other.multiply(PRIME32_2) ).rotl(13).multiply(PRIME32_1);
UINT32.prototype.xxh_update = function (low, high) {
    let b00 = PRIME32_2._low;
    let b16 = PRIME32_2._high;

    let c16;
    let c00;
    c00 = low * b00
    c16 = c00 >>> 16

    c16 += high * b00
    c16 &= 0xFFFF		// Not required but improves performance
    c16 += low * b16

    let a00 = this._low + (c00 & 0xFFFF);
    let a16 = a00 >>> 16;

    a16 += this._high + (c16 & 0xFFFF)

    let v = (a16 << 16) | (a00 & 0xFFFF);
    v = (v << 13) | (v >>> 19)

    a00 = v & 0xFFFF
    a16 = v >>> 16

    b00 = PRIME32_1._low
    b16 = PRIME32_1._high

    c00 = a00 * b00
    c16 = c00 >>> 16

    c16 += a16 * b00
    c16 &= 0xFFFF		// Not required but improves performance
    c16 += a00 * b16

    this._low = c00 & 0xFFFF
    this._high = c16 & 0xFFFF
}

/*
 * Constants
 */
var PRIME32_1 = UINT32( '2654435761' )
var PRIME32_2 = UINT32( '2246822519' )
const PRIME32_3 = UINT32( '3266489917' );
const PRIME32_4 = UINT32(  '668265263' );
const PRIME32_5 = UINT32(  '374761393' );

/**
* Convert string to proper UTF-8 array
* @param str Input string
* @returns {Uint8Array} UTF8 array is returned as uint8 array
*/
function toUTF8Array (str) {
	const utf8 = [];
	for (let i=0, n=str.length; i < n; i++) {
		let charcode = str.charCodeAt(i);
		if (charcode < 0x80) utf8.push(charcode)
		else if (charcode < 0x800) {
			utf8.push(0xc0 | (charcode >> 6),
			0x80 | (charcode & 0x3f))
		}
		else if (charcode < 0xd800 || charcode >= 0xe000) {
			utf8.push(0xe0 | (charcode >> 12),
			0x80 | ((charcode>>6) & 0x3f),
			0x80 | (charcode & 0x3f))
		}
		// surrogate pair
		else {
			i++;
			// UTF-16 encodes 0x10000-0x10FFFF by
			// subtracting 0x10000 and splitting the
			// 20 bits of 0x0-0xFFFFF into two halves
			charcode = 0x10000 + (((charcode & 0x3ff)<<10)
			| (str.charCodeAt(i) & 0x3ff))
			utf8.push(0xf0 | (charcode >>18),
			0x80 | ((charcode>>12) & 0x3f),
			0x80 | ((charcode>>6) & 0x3f),
			0x80 | (charcode & 0x3f))
		}
	}

	return new Uint8Array(utf8)
}

/**
 * XXH object used as a constructor or a function
 * @constructor
 * or
 * @param {Object|String} input data
 * @param {Number|UINT32} seed
 * @return ThisExpression
 * or
 * @return {UINT32} xxHash
 */
class XXH {
    constructor(...args) {
        if (args.length == 2)
            return new XXH( args[1] ).update( args[0] ).digest();

        if (!(this instanceof XXH))
            return new XXH( args[0] );

        init.call(this, args[0])
    }

    /**
     * Add data to be computed for the XXH hash
     * @method update
     * @param {String|Buffer|ArrayBuffer} input as a string or nodejs Buffer or ArrayBuffer
     * @return ThisExpression
     */
    update(input) {
        let isArrayBuffer;

        // Convert all strings to utf-8 first (issue #5)
        if (typeof input == 'string') {
            input = toUTF8Array(input)
            isArrayBuffer = true
        }

        if (typeof ArrayBuffer !== "undefined" && input instanceof ArrayBuffer)
        {
            isArrayBuffer = true
            input = new Uint8Array(input);
        }

        let p = 0;
        const len = input.length;
        const bEnd = p + len;

        if (len == 0) return this

        this.total_len += len

        if (this.memsize == 0)
        {
            if (isArrayBuffer) {
                this.memory = new Uint8Array(16)
            } else {
                this.memory = new Buffer(16)
            }
        }

        if (this.memsize + len < 16)   // fill in tmp buffer
        {
            // XXH_memcpy(this.memory + this.memsize, input, len)
            if (isArrayBuffer) {
                this.memory.set( input.subarray(0, len), this.memsize )
            } else {
                input.copy( this.memory, this.memsize, 0, len )
            }

            this.memsize += len
            return this
        }

        if (this.memsize > 0)   // some data left from previous update
        {
            // XXH_memcpy(this.memory + this.memsize, input, 16-this.memsize);
            if (isArrayBuffer) {
                this.memory.set( input.subarray(0, 16 - this.memsize), this.memsize )
            } else {
                input.copy( this.memory, this.memsize, 0, 16 - this.memsize )
            }

            let p32 = 0;
            this.v1.xxh_update(
                (this.memory[p32+1] << 8) | this.memory[p32]
            ,	(this.memory[p32+3] << 8) | this.memory[p32+2]
            )
            p32 += 4
            this.v2.xxh_update(
                (this.memory[p32+1] << 8) | this.memory[p32]
            ,	(this.memory[p32+3] << 8) | this.memory[p32+2]
            )
            p32 += 4
            this.v3.xxh_update(
                (this.memory[p32+1] << 8) | this.memory[p32]
            ,	(this.memory[p32+3] << 8) | this.memory[p32+2]
            )
            p32 += 4
            this.v4.xxh_update(
                (this.memory[p32+1] << 8) | this.memory[p32]
            ,	(this.memory[p32+3] << 8) | this.memory[p32+2]
            )

            p += 16 - this.memsize
            this.memsize = 0
        }

        if (p <= bEnd - 16)
        {
            const limit = bEnd - 16;

            do
            {
                this.v1.xxh_update(
                    (input[p+1] << 8) | input[p]
                ,	(input[p+3] << 8) | input[p+2]
                )
                p += 4
                this.v2.xxh_update(
                    (input[p+1] << 8) | input[p]
                ,	(input[p+3] << 8) | input[p+2]
                )
                p += 4
                this.v3.xxh_update(
                    (input[p+1] << 8) | input[p]
                ,	(input[p+3] << 8) | input[p+2]
                )
                p += 4
                this.v4.xxh_update(
                    (input[p+1] << 8) | input[p]
                ,	(input[p+3] << 8) | input[p+2]
                )
                p += 4
            } while (p <= limit)
        }

        if (p < bEnd)
        {
            // XXH_memcpy(this.memory, p, bEnd-p);
            if (isArrayBuffer) {
                this.memory.set( input.subarray(p, bEnd), this.memsize )
            } else {
                input.copy( this.memory, this.memsize, p, bEnd )
            }

            this.memsize = bEnd - p
        }

        return this
    }

    /**
     * Finalize the XXH computation. The XXH instance is ready for reuse for the given seed
     * @method digest
     * @return {UINT32} xxHash
     */
    digest() {
        const input = this.memory;
        let p = 0;
        const bEnd = this.memsize;
        let h32;
        let h;
        const u = new UINT32;

        if (this.total_len >= 16)
        {
            h32 = this.v1.rotl(1).add( this.v2.rotl(7).add( this.v3.rotl(12).add( this.v4.rotl(18) ) ) )
        }
        else
        {
            h32  = this.seed.clone().add( PRIME32_5 )
        }

        h32.add( u.fromNumber(this.total_len) )

        while (p <= bEnd - 4)
        {
            u.fromBits(
                (input[p+1] << 8) | input[p]
            ,	(input[p+3] << 8) | input[p+2]
            )
            h32
                .add( u.multiply(PRIME32_3) )
                .rotl(17)
                .multiply( PRIME32_4 )
            p += 4
        }

        while (p < bEnd)
        {
            u.fromBits( input[p++], 0 )
            h32
                .add( u.multiply(PRIME32_5) )
                .rotl(11)
                .multiply(PRIME32_1)
        }

        h = h32.clone().shiftRight(15)
        h32.xor(h).multiply(PRIME32_2)

        h = h32.clone().shiftRight(13)
        h32.xor(h).multiply(PRIME32_3)

        h = h32.clone().shiftRight(16)
        h32.xor(h)

        // Reset the state
        this.init( this.seed )

        return h32
    }
}

/**
 * Initialize the XXH instance with the given seed
 * @method init
 * @param {Number|Object} seed as a number or an unsigned 32 bits integer
 * @return ThisExpression
 */
function init (seed) {
   this.seed = seed instanceof UINT32 ? seed.clone() : UINT32(seed)
   this.v1 = this.seed.clone().add(PRIME32_1).add(PRIME32_2)
   this.v2 = this.seed.clone().add(PRIME32_2)
   this.v3 = this.seed.clone()
   this.v4 = this.seed.clone().subtract(PRIME32_1)
   this.total_len = 0
   this.memsize = 0
   this.memory = null

   return this
}
XXH.prototype.init = init

export default XXH
