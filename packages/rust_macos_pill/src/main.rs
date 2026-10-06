#![allow(deprecated, unexpected_cfgs)]

#[macro_use]
extern crate objc;

mod app;
mod constants;
mod draw;
mod gfx;
mod input;
mod ipc;
mod state;
mod wave_canvas;

fn main() {
    let (sender, receiver) = std::sync::mpsc::channel();
    ipc::start_stdin_reader(sender);
    app::run(receiver);
}
