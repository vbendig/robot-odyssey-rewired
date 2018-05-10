/* -*- Mode: C++; c-basic-offset: 4 -*-
 *
 * Copyright (c) 2009-2018 Micah Elizabeth Scott <micah@scanlime.org>
 *
 *    Permission is hereby granted, free of charge, to any person
 *    obtaining a copy of this software and associated documentation
 *    files (the "Software"), to deal in the Software without
 *    restriction, including without limitation the rights to use,
 *    copy, modify, merge, publish, distribute, sublicense, and/or sell
 *    copies of the Software, and to permit persons to whom the
 *    Software is furnished to do so, subject to the following
 *    conditions:
 *
 *    The above copyright notice and this permission notice shall be
 *    included in all copies or substantial portions of the Software.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 *    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 *    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 *    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 *    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 *    OTHER DEALINGS IN THE SOFTWARE.
 */

#include <emscripten.h>
#include <algorithm>
#include <string.h>
#include <stdio.h>
#include "sbt86.h"
#include "hardware.h"


OutputQueue::OutputQueue()
{
    clear();

    rgb_palette[0] = 0xff000000;
    rgb_palette[1] = 0xffffff55;
    rgb_palette[2] = 0xffff55ff;
    rgb_palette[3] = 0xffffffff;
}

OutputQueue::~OutputQueue()
{
    clear();
}

void OutputQueue::clear()
{
    while (!output_queue.empty()) {
        OutputItem item = output_queue.front();
        output_queue.pop_front();
        if (item.otype == OUT_FRAME) {
            delete item.u.framebuffer;
        }
    }
    output_queue_frame_count = 0;
    output_queue_delay_remaining = 0;
}

void OutputQueue::pushFrame(SBTStack *stack, uint8_t *framebuffer)
{
    if (output_queue_frame_count > 500) {
        stack->trace();
        assert(0 && "Frame queue is too deep! Infinite loop likely.");
    }

    OutputItem item;
    item.otype = OUT_FRAME;
    item.u.framebuffer = new CGAFramebuffer;
    memcpy(item.u.framebuffer, framebuffer, sizeof *item.u.framebuffer);
    output_queue.push_back(item);
    output_queue_frame_count++;
}

void OutputQueue::pushDelay(uint32_t millis)
{
    OutputItem item;
    item.otype = OUT_DELAY;
    item.u.delay = millis;
    output_queue.push_back(item);
}

void OutputQueue::pushSpeakerTimestamp(uint32_t timestamp)
{
    OutputItem item;
    item.otype = OUT_SPEAKER_TIMESTAMP;
    item.u.timestamp = timestamp;
    output_queue.push_back(item);
}

void OutputQueue::renderFrame(uint8_t *framebuffer)
{
    for (unsigned plane = 0; plane < 2; plane++) {
        for (unsigned y=0; y < SCREEN_HEIGHT/2; y++) {
            for (unsigned x=0; x < SCREEN_WIDTH; x++) {
                unsigned byte = 0x2000*plane + (x + SCREEN_WIDTH*y)/4;
                unsigned bit = 3 - (x % 4);
                unsigned color = 0x3 & (framebuffer[byte] >> (bit * 2));
                uint32_t rgb = rgb_palette[color];
                rgb_pixels[x + (y*2+plane)*SCREEN_WIDTH] = rgb;
            }
        }
    }

    EM_ASM_({
        Module.onRenderFrame(HEAPU8.subarray($0, $0 + 320*200*4))
    }, rgb_pixels);
}

uint32_t OutputQueue::run()
{
    // Generate output until the queue is empty (returning zero) or
    // a delay (returning a nonzero number of milliseconds)

    static const uint32_t max_delay_per_step = 100;

    while (true) {
        if (output_queue_delay_remaining > 0) {
            uint32_t delay = std::min(output_queue_delay_remaining, max_delay_per_step);
            output_queue_delay_remaining -= delay;
            return delay;

        } else if (output_queue.empty()) {
            return 0;

        } else {
            OutputItem item = output_queue.front();
            output_queue.pop_front();

            switch (item.otype) {

                case OUT_FRAME:
                    renderFrame(item.u.framebuffer->bytes);
                    output_queue_frame_count--;
                    delete item.u.framebuffer;
                    break;

                case OUT_DELAY:
                    output_queue_delay_remaining += item.u.delay;
                    break;

                case OUT_SPEAKER_TIMESTAMP:
                    // fprintf(stderr, "TODO, sound at %d\n", item.u.timestamp);
                    break;
            }
        }
    }
}