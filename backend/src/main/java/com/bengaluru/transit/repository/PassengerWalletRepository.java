package com.bengaluru.transit.repository;

import com.bengaluru.transit.entity.PassengerWallet;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PassengerWalletRepository extends JpaRepository<PassengerWallet, Long> {
    Optional<PassengerWallet> findByUser_UserId(Long userId);
}